
// // const { BlobServiceClient } = require("@azure/storage-blob");  // Ensure proper import
// // require("dotenv").config();  // Load environment variables from .env file

// // // Get environment variables from .env
// // const ACCOUNT_NAME = process.env.ACCOUNT_NAME;
// // const ACCOUNT_KEY = process.env.ACCOUNT_KEY;
// // const LOGIN_CONTAINER = process.env.LOGIN_CONTAINER;
// // const APPLIED_JOB_CONTAINER = process.env.APPLIED_JOB_CONTAINER;

// // const AZURE_STORAGE_CONNECTION_STRING = `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT_NAME};AccountKey=${ACCOUNT_KEY};EndpointSuffix=core.windows.net`;

// // // Azure function entry point
// // module.exports = async function (context, req) {
// //     try {
// //         const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

// //         // Step 1: Get the latest logged-in user
// //         const loginContainerClient = blobServiceClient.getContainerClient(LOGIN_CONTAINER);

// //         let latestBlob = null;
// //         let latestTime = 0;

// //         for await (const blob of loginContainerClient.listBlobsFlat()) {
// //             const blobClient = loginContainerClient.getBlobClient(blob.name);
// //             const props = await blobClient.getProperties();
// //             const modifiedTime = new Date(props.lastModified).getTime();

// //             if (modifiedTime > latestTime) {
// //                 latestTime = modifiedTime;
// //                 latestBlob = blobClient;
// //             }
// //         }

// //         if (!latestBlob) {
// //             context.res = {
// //                 status: 404,
// //                 body: "No logged-in user data found."
// //             };
// //             return;
// //         }

// //         const loginDownloadResponse = await latestBlob.download();
// //         const loginData = await streamToText(loginDownloadResponse.readableStreamBody);
// //         const user = JSON.parse(loginData);
// //         const applicantEmail = user.email?.trim().toLowerCase();

// //         if (!applicantEmail) {
// //             context.res = {
// //                 status: 400,
// //                 body: "Logged-in user email not found."
// //             };
// //             return;
// //         }

// //         context.log("Logged-in user email:", applicantEmail);

// //         // Step 2: Check each blob in the applied jobs container
// //         const appliedContainerClient = blobServiceClient.getContainerClient(APPLIED_JOB_CONTAINER);
// //         let deleted = false;

// //         // Loop through each blob in the applied jobs container
// //         for await (const blob of appliedContainerClient.listBlobsFlat()) {
// //             const blobClient = appliedContainerClient.getBlockBlobClient(blob.name);
// //             const downloadResponse = await blobClient.download();
// //             const content = await streamToText(downloadResponse.readableStreamBody);

// //             let applications;
// //             try {
// //                 applications = JSON.parse(content);
// //                 if (!Array.isArray(applications)) continue;
// //             } catch (e) {
// //                 context.log(`Invalid JSON format in blob: ${blob.name}`);
// //                 continue;
// //             }

// //             const originalLength = applications.length;

// //             // Step 3: Filter out applications that match the provided criteria
// //             const filteredApplications = applications.filter(app => {
// //                 // Check if each field matches exactly and status is "Pending"
// //                 const emailMatch = (app.applicantEmail || "").trim().toLowerCase() === applicantEmail;
// //                 const statusMatch = (app.status || "").trim().toLowerCase() === "pending";
// //                 const jobIdMatch = (app.jobId || "").trim().toLowerCase() === (req.body.jobId || "").trim().toLowerCase();
// //                 const titleMatch = (app.title || "").trim().toLowerCase() === (req.body.title || "").trim().toLowerCase();
// //                 const locationMatch = (app.location || "").trim().toLowerCase() === (req.body.location || "").trim().toLowerCase();
// //                 const employerEmailMatch = (app.employerEmail || "").trim().toLowerCase() === (req.body.employerEmail || "").trim().toLowerCase();

// //                 // Only match if all fields are the same and status is "pending"
// //                 return !(emailMatch && statusMatch && jobIdMatch && titleMatch && locationMatch && employerEmailMatch);
// //             });

// //             if (filteredApplications.length < originalLength) {
// //                 // At least one matching application was removed
// //                 deleted = true;
// //                 const updatedContent = JSON.stringify(filteredApplications, null, 2);
// //                 await blobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
// //                     overwrite: true
// //                 });
// //                 break; // Remove this break to continue processing other blobs
// //             }
// //         }

// //         context.res = {
// //             status: deleted ? 200 : 404,
// //             body: deleted
// //                 ? "Pending application(s) deleted successfully."
// //                 : "No matching pending applications found for the logged-in user."
// //         };
// //     } catch (error) {
// //         context.log("Error during delete operation:", error.message);
// //         context.res = {
// //             status: 500,
// //             body: "Internal server error during delete operation."
// //         };
// //     }
// // };

// // // Utility to read stream as text
// // async function streamToText(readable) {
// //     const chunks = [];
// //     for await (const chunk of readable) {
// //         chunks.push(chunk.toString());
// //     }
// //     return chunks.join('');
// // }
// const { BlobServiceClient } = require("@azure/storage-blob");
// require("dotenv").config();

// const ACCOUNT_NAME = process.env.ACCOUNT_NAME;
// const ACCOUNT_KEY = process.env.ACCOUNT_KEY;
// const LOGIN_CONTAINER = process.env.LOGIN_CONTAINER;
// const APPLIED_JOB_CONTAINER = process.env.APPLIED_JOB_CONTAINER;

// const AZURE_STORAGE_CONNECTION_STRING = `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT_NAME};AccountKey=${ACCOUNT_KEY};EndpointSuffix=core.windows.net`;

// module.exports = async function (context, req) {
//     try {
//         const { jobId, title, location, employerEmail, applicantEmail, status } = req.body;

//         if (!jobId || !applicantEmail || status.toLowerCase() !== 'pending') {
//             context.res = {
//                 status: 400,
//                 body: "Invalid request body or only pending applications can be deleted."
//             };
//             return;
//         }

//         const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

//         const appliedContainerClient = blobServiceClient.getContainerClient(APPLIED_JOB_CONTAINER);
//         let found = false;

//         for await (const blob of appliedContainerClient.listBlobsFlat()) {
//             const blobClient = appliedContainerClient.getBlockBlobClient(blob.name);
//             const downloadResponse = await blobClient.download();
//             const content = await streamToText(downloadResponse.readableStreamBody);

//             let applications = [];
//             try {
//                 applications = JSON.parse(content);
//             } catch (err) {
//                 continue;
//             }

//             const initialLength = applications.length;

//             const filteredApps = applications.filter(app => {
//                 return !(
//                     (app.jobId || "").trim().toLowerCase() === jobId.trim().toLowerCase() &&
//                     (app.applicantEmail || "").trim().toLowerCase() === applicantEmail.trim().toLowerCase() &&
//                     (app.status || "").trim().toLowerCase() === 'pending'
//                 );
//             });

//             if (filteredApps.length !== initialLength) {
//                 found = true;
//                 const updatedContent = JSON.stringify(filteredApps, null, 2);
//                 await blobClient.upload(updatedContent, Buffer.byteLength(updatedContent), {
//                     overwrite: true,
//                 });
//                 break;
//             }
//         }

//         context.res = {
//             status: found ? 200 : 404,
//             body: found ? "Application deleted successfully." : "Application not found or already processed."
//         };
//     } catch (error) {
//         context.log("Error deleting application:", error.message);
//         context.res = {
//             status: 500,
//             body: "Internal Server Error"
//         };
//     }
// };

// // Helper
// async function streamToText(readable) {
//     return new Promise((resolve, reject) => {
//         const chunks = [];
//         readable.on("data", (chunk) => chunks.push(chunk));
//         readable.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
//         readable.on("error", reject);
//     });
// }
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
