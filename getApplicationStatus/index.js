
const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}

// Get logged-in user info (email + role)
async function getLoggedInUser() {
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
    const downloaded = await streamToString(downloadResponse.readableStreamBody);
    const userData = JSON.parse(downloaded);

    console.log("Logged-in user:", userData);
    return userData; // Should include email and role
}

module.exports = async function (context, req) {
    try {
        const user = await getLoggedInUser();

        if (user.role !== "employer") {
            context.res = {
                status: 403,
                body: "Access denied. Only employers can fetch these applications."
            };
            return;
        }

        const employerEmail = user.email;
        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${process.env.ACCOUNT_NAME};AccountKey=${process.env.ACCOUNT_KEY};EndpointSuffix=core.windows.net`;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(process.env.APPLIED_JOB_CONTAINER);

        let matchingApplications = [];

        for await (const blob of containerClient.listBlobsFlat()) {
            const blobClient = containerClient.getBlobClient(blob.name);
            const downloadResponse = await blobClient.download();
            const content = await streamToString(downloadResponse.readableStreamBody);

            try {
                const applications = JSON.parse(content);
                if (Array.isArray(applications)) {
                    const filtered = applications.filter(app =>
                        app.employerEmail?.toLowerCase().trim() === employerEmail.toLowerCase().trim()
                    );
                    matchingApplications.push(...filtered);
                }
            } catch (err) {
                context.log(`Failed to parse blob ${blob.name}: ${err.message}`);
            }
        }

        context.res = {
            status: 200,
            body: {
                employerEmail,
                applications: matchingApplications
            }
        };

    } catch (err) {
        context.log("Error in getApplicationsByEmployer:", err.message);
        context.res = {
            status: 500,
            body: "Failed to retrieve applications for employer."
        };
    }
};
