
// const { BlobServiceClient } = require("@azure/storage-blob");
// require("dotenv").config();

// // Helper to convert blob stream to string
// async function streamToString(readableStream) {
//     return new Promise((resolve, reject) => {
//         const chunks = [];
//         readableStream.on("data", (data) => chunks.push(data.toString()));
//         readableStream.on("end", () => resolve(chunks.join("")));
//         readableStream.on("error", reject);
//     });
// }

// // 🔐 Get email of logged-in user from the latest login blob
// async function getLoggedInUserEmail() {
//     const account = process.env.ACCOUNT_NAME;
//     const accountKey = process.env.ACCOUNT_KEY;
//     const containerName = process.env.LOGIN_CONTAINER;

//     const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
//     const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
//     const containerClient = blobServiceClient.getContainerClient(containerName);

//     let latestBlob = null;
//     let latestTime = 0;

//     for await (const blob of containerClient.listBlobsFlat()) {
//         const blobClient = containerClient.getBlobClient(blob.name);
//         const properties = await blobClient.getProperties();
//         const lastModified = new Date(properties.lastModified).getTime();

//         if (lastModified > latestTime) {
//             latestTime = lastModified;
//             latestBlob = blobClient;
//         }
//     }

//     if (!latestBlob) {
//         throw new Error("No login data found in blob storage.");
//     }

//     const downloadResponse = await latestBlob.download();
//     const downloaded = await streamToString(downloadResponse.readableStreamBody);
//     const userData = JSON.parse(downloaded);

//     return userData.email;
// }

// // 🔍 Get employer email from the post job container based on employer's job posting
// async function getEmployerEmailFromPostJob() {
//     const account = process.env.ACCOUNT_NAME;
//     const accountKey = process.env.ACCOUNT_KEY;
//     const containerName = process.env.POST_JOB_CONTAINER;

//     const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
//     const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
//     const containerClient = blobServiceClient.getContainerClient(containerName);

//     let employerEmail = null;

//     // Loop through all job blobs and check for employer email in the job metadata or file content
//     for await (const blob of containerClient.listBlobsFlat()) {
//         const blobClient = containerClient.getBlobClient(blob.name);
//         const downloadResponse = await blobClient.download();
//         const content = await streamToString(downloadResponse.readableStreamBody);

//         try {
//             const jobs = JSON.parse(content);
//             if (Array.isArray(jobs)) {
//                 // Look for employer email in the job metadata (assumed stored in a JSON format)
//                 const employerJob = jobs.find(job => job.employerEmail);
//                 if (employerJob && employerJob.employerEmail) {
//                     employerEmail = employerJob.employerEmail;
//                     break;
//                 }
//             }
//         } catch (err) {
//             console.error(`Error parsing job blob: ${err.message}`);
//         }
//     }

//     if (!employerEmail) {
//         throw new Error("Employer email not found in post job container.");
//     }

//     return employerEmail;
// }

// module.exports = async function (context, req) {
//     const application = req.body;

//     if (!application || !application.jobId) {
//         context.res = {
//             status: 400,
//             body: "Missing required application fields."
//         };
//         return;
//     }

//     try {
//         // Get the logged-in user's email
//         const email = await getLoggedInUserEmail();

//         // Get the employer's email from the post job container
//         const employerEmail = await getEmployerEmailFromPostJob();

//         const connectionString = `DefaultEndpointsProtocol=https;AccountName=${process.env.ACCOUNT_NAME};AccountKey=${process.env.ACCOUNT_KEY};EndpointSuffix=core.windows.net`;
//         const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
//         const containerClient = blobServiceClient.getContainerClient(process.env.APPLIED_JOB_CONTAINER);
//         await containerClient.createIfNotExists();

//         const emailBlobName = `${email}.json`;
//         const blockBlobClient = containerClient.getBlockBlobClient(emailBlobName);

//         let existingApplications = [];

//         if (await blockBlobClient.exists()) {
//             const downloadResponse = await blockBlobClient.download();
//             const downloaded = await streamToString(downloadResponse.readableStreamBody);
//             existingApplications = JSON.parse(downloaded);
//         }

//         const alreadyApplied = existingApplications.some(app => app.jobId === application.jobId);
//         if (alreadyApplied) {
//             context.res = {
//                 status: 409,
//                 body: "You have already applied for this job."
//             };
//             return;
//         }

//         const fullApplication = {
//             ...application,
//             applicantEmail: email,
//             employerEmail: employerEmail  // Add employer email to the application
//         };

//         existingApplications.push(fullApplication);
//         const updatedData = JSON.stringify(existingApplications, null, 2);
//         await blockBlobClient.upload(updatedData, Buffer.byteLength(updatedData), { overwrite: true });

//         context.res = {
//             status: 200,
//             body: { message: "Application stored successfully." }
//         };
//     } catch (err) {
//         context.log("Upload error:", err.message);
//         context.res = {
//             status: 500,
//             body: `Server error: ${err.message}`
//         };
//     }
// };
const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

// Convert stream to string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}

// Get logged-in user email from latest login blob
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
    const application = req.body;

    if (!application || !application.jobId || !application.employerEmail) {
        context.res = {
            status: 400,
            body: "Missing required application fields (jobId or employerEmail)."
        };
        return;
    }

    try {
        // Get logged-in user's email
        const email = await getLoggedInUserEmail();

        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${process.env.ACCOUNT_NAME};AccountKey=${process.env.ACCOUNT_KEY};EndpointSuffix=core.windows.net`;
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(process.env.APPLIED_JOB_CONTAINER);
        await containerClient.createIfNotExists();

        const emailBlobName = `${email}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(emailBlobName);

        let existingApplications = [];

        if (await blockBlobClient.exists()) {
            const downloadResponse = await blockBlobClient.download();
            const downloaded = await streamToString(downloadResponse.readableStreamBody);
            existingApplications = JSON.parse(downloaded);
        }

        const alreadyApplied = existingApplications.some(app => app.jobId === application.jobId);
        if (alreadyApplied) {
            context.res = {
                status: 409,
                body: "You have already applied for this job."
            };
            return;
        }

        const fullApplication = {
            ...application,
            applicantEmail: email
            // ✅ employerEmail is already in application and trusted
        };

        existingApplications.push(fullApplication);
        const updatedData = JSON.stringify(existingApplications, null, 2);
        await blockBlobClient.upload(updatedData, Buffer.byteLength(updatedData), { overwrite: true });

        context.res = {
            status: 200,
            body: { message: "Application stored successfully." }
        };
    } catch (err) {
        context.log("Upload error:", err.message);
        context.res = {
            status: 500,
            body: `Server error: ${err.message}`
        };
    }
};
