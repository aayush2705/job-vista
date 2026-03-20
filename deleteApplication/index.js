const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

const ACCOUNT_NAME = process.env.ACCOUNT_NAME;
const ACCOUNT_KEY = process.env.ACCOUNT_KEY;
const APPLIED_JOB_CONTAINER = process.env.APPLIED_JOB_CONTAINER;

const AZURE_STORAGE_CONNECTION_STRING = `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT_NAME};AccountKey=${ACCOUNT_KEY};EndpointSuffix=core.windows.net`;

module.exports = async function (context, req) {
    try {
        const { title, location, status, applicantEmail } = req.body;

        if (!applicantEmail || !status || status.toLowerCase() !== "pending") {
            context.res = {
                status: 400,
                body: "Missing required fields or only 'pending' applications can be deleted."
            };
            return;
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
        const containerClient = blobServiceClient.getContainerClient(APPLIED_JOB_CONTAINER);

        let deleted = false;

        for await (const blob of containerClient.listBlobsFlat()) {
            const blobClient = containerClient.getBlockBlobClient(blob.name);
            const downloadResponse = await blobClient.download();
            const content = await streamToText(downloadResponse.readableStreamBody);

            let applications;
            try {
                applications = JSON.parse(content);
            } catch {
                continue; // skip invalid blobs
            }

            const initialLength = applications.length;

            const filtered = applications.filter(app => {
                const match =
                    (!title || (app.title || "").toLowerCase() === title.toLowerCase()) &&
                    (!location || (app.location || "").toLowerCase() === location.toLowerCase()) &&
                    (!status || (app.status || "").toLowerCase() === status.toLowerCase()) &&
                    (!applicantEmail || (app.applicantEmail || "").toLowerCase() === applicantEmail.toLowerCase());

                return !match; // Keep all except the ones we want to delete
            });

            if (filtered.length !== initialLength) {
                const updatedContent = JSON.stringify(filtered, null, 2);
                await blobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
                    overwrite: true,
                });
                deleted = true;
            }
        }

        context.res = {
            status: deleted ? 200 : 404,
            body: deleted ? "Matching applications deleted." : "No matching applications found to delete."
        };
    } catch (error) {
        context.log("Error deleting applications:", error.message);
        context.res = {
            status: 500,
            body: "Internal Server Error"
        };
    }
};

async function streamToText(readable) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readable.on("data", (chunk) => chunks.push(chunk));
        readable.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        readable.on("error", reject);
    });
}
