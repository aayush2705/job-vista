const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

// 🔄 Convert blob stream to string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}

// 🔐 Get email of logged-in user from latest login blob
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
        throw new Error("No login data found in blob storage.");
    }

    const downloadResponse = await latestBlob.download();
    const downloaded = await streamToString(downloadResponse.readableStreamBody);
    const userData = JSON.parse(downloaded);

    return userData.email;
}

module.exports = async function (context, req) {
    context.log("🔔 Post Job function triggered");

    let formData = req.body;

    if (!formData && req.rawBody) {
        try {
            formData = JSON.parse(req.rawBody);
        } catch (parseErr) {
            context.log.error("❌ Failed to parse raw body:", parseErr.message);
            context.res = {
                status: 400,
                body: "Invalid JSON format."
            };
            return;
        }
    }

    const { title, description, location, salary, type } = formData || {};
    if (!title || !description || !location || !salary || !type) {
        context.log.warn("⚠️ Missing required fields in the form");
        context.res = {
            status: 400,
            body: "Missing required fields in the form."
        };
        return;
    }

    try {
        // Get the employer's email
        const email = await getLoggedInUserEmail();

        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${process.env.ACCOUNT_NAME};AccountKey=${process.env.ACCOUNT_KEY};EndpointSuffix=core.windows.net`;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(process.env.POST_JOB_CONTAINER);

        await containerClient.createIfNotExists();

        const emailBlobName = `${email}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(emailBlobName);

        let existingJobs = [];

        if (await blockBlobClient.exists()) {
            const downloadResponse = await blockBlobClient.download();
            const downloaded = await streamToString(downloadResponse.readableStreamBody);
            existingJobs = JSON.parse(downloaded);
        }

        const newJob = {
            title,
            description,
            location,
            salary,
            type,
            postedAt: new Date().toISOString(),
            employerEmail: email  // ✅ Include employer's email
        };

        existingJobs.push(newJob);

        const updatedData = JSON.stringify(existingJobs, null, 2);
        await blockBlobClient.upload(updatedData, Buffer.byteLength(updatedData), { overwrite: true });

        context.res = {
            status: 200,
            body: { message: "Job posted successfully." }
        };

    } catch (error) {
        context.log.error("❌ Error posting job:", error.message);
        context.res = {
            status: 500,
            body: `Server error: ${error.message}`
        };
    }
};
