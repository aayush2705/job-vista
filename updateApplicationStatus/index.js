
const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');
dotenv.config();

const containerName = process.env.APPLIED_JOB_CONTAINER;
const connectionString = `DefaultEndpointsProtocol=https;AccountName=${process.env.ACCOUNT_NAME};AccountKey=${process.env.ACCOUNT_KEY};EndpointSuffix=core.windows.net`;

module.exports = async function (context, req) {
    const { applicantEmail, employerEmail, title, status } = req.body;

    if (!applicantEmail || !employerEmail || !title || !status) {
        context.res = {
            status: 400,
            body: "Missing fields: applicantEmail, employerEmail, title and/or status"
        };
        return;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        let found = false;

        for await (const blob of containerClient.listBlobsFlat()) {
            const blobClient = containerClient.getBlobClient(blob.name);
            const downloadResponse = await blobClient.download();
            const content = await streamToBuffer(downloadResponse.readableStreamBody);

            let applications;
            try {
                applications = JSON.parse(content.toString());
            } catch (e) {
                context.log(`Skipping ${blob.name} - Invalid JSON`);
                continue;
            }

            if (!Array.isArray(applications)) continue;

            let updated = false;

            for (let app of applications) {
                if (
                    app.applicantEmail?.toLowerCase().trim() === applicantEmail.toLowerCase().trim() &&
                    app.employerEmail?.toLowerCase().trim() === employerEmail.toLowerCase().trim() &&
                    app.title?.toLowerCase().trim() === title.toLowerCase().trim()
                ) {
                    app.status = status;
                    updated = true;
                    found = true;
                }
            }

            if (updated) {
                const updatedContent = JSON.stringify(applications, null, 2);
                const blockBlobClient = blobClient.getBlockBlobClient();
                await blockBlobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
                    overwrite: true,
                    blobHTTPHeaders: { blobContentType: "application/json" }
                });
                break; // Only update the first match
            }
        }

        if (!found) {
            context.res = {
                status: 404,
                body: "No matching application found for the given applicantEmail, employerEmail, and title"
            };
            return;
        }

        context.res = {
            status: 200,
            body: { message: "Application status updated successfully" }
        };
    } catch (err) {
        context.log("Error updating application status:", err.message);
        context.res = {
            status: 500,
            body: { error: "Failed to update application status" }
        };
    }
};

async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data instanceof Buffer ? data : Buffer.from(data)));
        readableStream.on("end", () => resolve(Buffer.concat(chunks)));
        readableStream.on("error", reject);
    });
}
