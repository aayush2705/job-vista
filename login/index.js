const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

module.exports = async function (context, req) {
    context.log('Login API triggered.');

    const { email, password, role } = req.body || {};

    if (!email || !password || !role) {
        context.res = {
            status: 400,
            body: "Email, Password, and Role are required."
        };
        return;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(
            `DefaultEndpointsProtocol=https;AccountName=${process.env.ACCOUNT_NAME};AccountKey=${process.env.ACCOUNT_KEY};EndpointSuffix=core.windows.net`
        );

        // Determine container name based on role
        let userContainerName = '';
        if (role.toLowerCase() === 'employer') {
            userContainerName = process.env.EMPLOYER_CONTAINER;
        } else if (role.toLowerCase() === 'employee') {
            userContainerName = process.env.EMPLOYEE_CONTAINER;
        } else {
            context.res = {
                status: 400,
                body: "Invalid role. Must be 'employer' or 'employee'."
            };
            return;
        }

        const userContainerClient = blobServiceClient.getContainerClient(userContainerName);
        const blobName = `${email.toLowerCase()}.json`;
        const userBlobClient = userContainerClient.getBlockBlobClient(blobName);

        const userExists = await userBlobClient.exists();
        if (!userExists) {
            context.res = {
                status: 404,
                body: "User not found. Please register first."
            };
            return;
        }

        // Read and parse user data
        const downloadResponse = await userBlobClient.download();
        const userData = JSON.parse(await streamToString(downloadResponse.readableStreamBody));

        if (userData.password !== password) {
            context.res = {
                status: 401,
                body: "Invalid credentials. Incorrect password."
            };
            return;
        }

        // Save login session to 'login' container
        const loginContainerClient = blobServiceClient.getContainerClient(process.env.LOGIN_CONTAINER);
        await loginContainerClient.createIfNotExists();

        const loginBlobClient = loginContainerClient.getBlockBlobClient(blobName);

        const loginData = {
            email: userData.email,
            name: userData.name || "", // Optional name
            role: role.toLowerCase(),
            loginTime: new Date().toISOString()
        };

        await loginBlobClient.upload(
            JSON.stringify(loginData),
            Buffer.byteLength(JSON.stringify(loginData)),
            { overwrite: true }
        );
        context.res = {
            status: 200,
            body: `Login successful as ${role}!`
        };

    } catch (error) {
        context.log('Error during login:', error.message);

        context.res = {
            status: 500,
            body: "Error during login process."
        };
    }
};
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}
