
const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

// Convert blob stream to string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}

// Get currently logged-in user's email
async function getLoggedInUserEmail() {
    const account = process.env.ACCOUNT_NAME;
    const accountKey = process.env.ACCOUNT_KEY;
    const containerName = process.env.LOGIN_CONTAINER;

    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    let latestBlob = null;
    let latestTime = 0;

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
        throw new Error("No login data found.");
    }

    const downloadResponse = await latestBlob.download();
    const content = await streamToString(downloadResponse.readableStreamBody);
    const user = JSON.parse(content);
    return user.email;
}

// Main Azure Function
module.exports = async function (context, req) {
    try {
        const email = await getLoggedInUserEmail();

        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${process.env.ACCOUNT_NAME};AccountKey=${process.env.ACCOUNT_KEY};EndpointSuffix=core.windows.net`;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(process.env.POST_JOB_CONTAINER);

        const userBlobName = `${email}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(userBlobName);

        if (!(await blockBlobClient.exists())) {
            context.res = {
                status: 200,
                body: [] // No posted jobs yet for this user
            };
            return;
        }

        const downloadBlockBlobResponse = await blockBlobClient.download();
        const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);
        const postedJobs = JSON.parse(downloaded);

        context.res = {
            status: 200,
            body: postedJobs
        };
    } catch (err) {
        context.log("Error fetching posted jobs:", err.message);
        context.res = {
            status: 500,
            body: "Failed to retrieve posted jobs."
        };
    }
};
