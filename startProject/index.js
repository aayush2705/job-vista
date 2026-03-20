const path = require('path');
const fs = require('fs').promises;
// Import API handlers
const loginAPI = require('../login');
const registerAPI = require('../register');
const frontendPagesAPI = require('../frontendpages');
const serverFrontendAPI = require('../serverfrontend');

module.exports = async function (context, req) {
    context.log('StartProject API triggered.');

    const page = req.query.page || 'welcome'; // Default to welcome.html
    const type = req.query.type || 'frontend'; // type = frontend | api

    if (type === 'frontend') {
        await serveFrontend(context, page);
    } else if (type === 'api') {
        await handleAPI(context, req, page);
    } else {
        context.res = {
            status: 400,
            body: "Invalid request type. Use type=frontend or type=api."
        };
    }
};

// ---------- SERVE FRONTEND HTML ---------- //
async function serveFrontend(context, page) {
    const allowedPages = [
        'applications',
        'employee',
        'employer',
        'index',
        'login',
        'myapplications',
        'postjob',
        'register',
        'viewjobs',
        'welcome'
    ];

    if (!allowedPages.includes(page)) {
        context.res = {
            status: 400,
            body: "Invalid page requested."
        };
        return;
    }

    const filePath = path.join(__dirname, '../frontend', `${page}.html`);

    try {
        const content = await fs.readFile(filePath, 'utf8');
        context.res = {
            status: 200,
            headers: { "Content-Type": "text/html" },
            body: content
        };
    } catch (error) {
        context.log(error.message);
        context.res = {
            status: 404,
            body: "Page not found."
        };
    }
}

// ---------- HANDLE API CALLS ---------- //
async function handleAPI(context, req, page) {
    switch (page.toLowerCase()) {
        case 'login':
            await loginAPI(context, req);
            break;
        case 'register':
            await registerAPI(context, req);
            break;
        case 'frontendpages':
            await frontendPagesAPI(context, req);
            break;
        case 'serverfrontend':
            await serverFrontendAPI(context, req);
            break;
        default:
            context.res = {
                status: 404,
                body: "API not found. Available APIs: login, register, frontendpages, serverfrontend."
            };
            break;
    }
}
