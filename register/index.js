const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

module.exports = async function (context, req) {
    context.log('Register API triggered.');

    const { username, firstName, lastName, dob, email, password, role } = req.body || {};

    if (!username || !firstName || !lastName || !dob || !email || !password || !role) {
        context.res = {
            status: 400,
            body: "All fields are required."
        };
        return;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(
            `DefaultEndpointsProtocol=https;AccountName=${process.env.ACCOUNT_NAME};AccountKey=${process.env.ACCOUNT_KEY};EndpointSuffix=core.windows.net`
        );

        const registerContainerClient = blobServiceClient.getContainerClient(process.env.REGISTER_CONTAINER);

        // Ensure register container exists
        if (!(await registerContainerClient.exists())) {
            await registerContainerClient.create();
            context.log('Created container:', process.env.REGISTER_CONTAINER);
        }

        const blobName = `${email.toLowerCase()}.json`;
        const registerBlobClient = registerContainerClient.getBlockBlobClient(blobName);

        // Check if user already exists
        const userExists = await registerBlobClient.exists();
        if (userExists) {
            context.res = {
                status: 409,
                body: "User with this email already exists."
            };
            return;
        }

        // Additional username check
        let usernameTaken = false;
        for await (const blob of registerContainerClient.listBlobsFlat()) {
            const blobClient = registerContainerClient.getBlobClient(blob.name);
            const downloadResponse = await blobClient.download();
            const userData = JSON.parse(await streamToString(downloadResponse.readableStreamBody));
            if (userData.username.toLowerCase() === username.toLowerCase()) {
                usernameTaken = true;
                break;
            }
        }

        if (usernameTaken) {
            context.res = {
                status: 409,
                body: "Username already taken."
            };
            return;
        }

        const userData = {
            username,
            firstName,
            lastName,
            dob,
            email: email.toLowerCase(),
            password, // Note: Hash it in production
            role: role.toLowerCase(),
            timestamp: new Date().toISOString()
        };

        const userDataString = JSON.stringify(userData);

        // Upload to 'register' container
        await registerBlobClient.upload(userDataString, Buffer.byteLength(userDataString));

        // Also upload to role-specific container
        const roleContainerName = role.toLowerCase() === 'employer'
            ? process.env.EMPLOYER_CONTAINER
            : process.env.EMPLOYEE_CONTAINER;

        const roleContainerClient = blobServiceClient.getContainerClient(roleContainerName);

        if (!(await roleContainerClient.exists())) {
            await roleContainerClient.create();
            context.log('Created container:', roleContainerName);
        }

        const roleBlobClient = roleContainerClient.getBlockBlobClient(blobName);
        await roleBlobClient.upload(userDataString, Buffer.byteLength(userDataString));

        context.log(`User "${email}" registered successfully in register and ${roleContainerName} containers.`);
        context.res = {
            status: 201,
            body: "Registration successful!"
        };

    } catch (error) {
        context.log('Registration error:', error.message);
        context.res = {
            status: 500,
            body: "Error during registration."
        };
    }
};

async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => {
            chunks.push(data.toString());
        });
        readableStream.on("end", () => {
            resolve(chunks.join(""));
        });
        readableStream.on("error", reject);
    });
}