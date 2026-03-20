const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

module.exports = async function (context, req) {
    try {
        const account = process.env.ACCOUNT_NAME;
        const accountKey = process.env.ACCOUNT_KEY;
        const containerName = process.env.LOGIN_CONTAINER;

        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        let latestBlob = null;
        let latestTime = 0;

        // Loop through blobs and find the latest one
        for await (const blob of containerClient.listBlobsFlat()) {
            const blobClient = containerClient.getBlobClient(blob.name);
            const properties = await blobClient.getProperties();

            const lastModified = new Date(properties.lastModified).getTime();
            if (lastModified > latestTime) {
                latestTime = lastModified;
                latestBlob = blobClient;
            }
        }

        if (!latestBlob) {
            context.res = {
                status: 404,
                body: { message: 'No login data found in blob storage.' },
            };
            return;
        }

        // Download blob content
        const downloadBlockBlobResponse = await latestBlob.download();
        const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);
        const userData = JSON.parse(downloaded);

        context.res = {
            status: 200,
            body: userData,
        };

    } catch (error) {
        context.log.error("Error in getLoggedInUser:", error.message);
        context.res = {
            status: 500,
            body: { error: "Failed to fetch logged in user data" },
        };
    }
};

// Helper to convert blob stream to string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}
