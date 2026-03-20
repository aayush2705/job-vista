const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
require('dotenv').config();

module.exports = async function (context, req) {
    const account = process.env.ACCOUNT_NAME;
    const accountKey = process.env.ACCOUNT_KEY;
    const containerName = process.env.POST_JOB_CONTAINER;

    try {
        const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);
        const blobServiceClient = new BlobServiceClient(
            `https://${account}.blob.core.windows.net`,
            sharedKeyCredential
        );

        const containerClient = blobServiceClient.getContainerClient(containerName);
        const jobList = [];

        for await (const blob of containerClient.listBlobsFlat()) {
            if (blob.name.endsWith(".json")) {
                const blobClient = containerClient.getBlockBlobClient(blob.name);
                const downloadBlockBlobResponse = await blobClient.download(0);
                const content = await streamToString(downloadBlockBlobResponse.readableStreamBody);

                try {
                    const json = JSON.parse(content);
                    // Either push one job or many (array vs object detection)
                    if (Array.isArray(json)) {
                        jobList.push(...json);
                    } else {
                        jobList.push(json);
                    }
                } catch (err) {
                    context.log.warn(`Skipping invalid JSON file: ${blob.name}`);
                }
            }
        }

        context.res = {
            status: 200,
            body: jobList
        };
    } catch (error) {
        context.log.error("Failed to fetch jobs:", error.message);
        context.res = {
            status: 500,
            body: "Failed to fetch jobs"
        };
    }
};

async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", chunk => chunks.push(chunk.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}
