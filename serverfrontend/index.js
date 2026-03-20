const path = require('path');
const fs = require('fs').promises;

module.exports = async function (context, req) {
    // Get the requested page from query string like ?page=login
    const page = req.query.page || 'welcome'; // default to index.html if not specified

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

    // Security: Check if requested page is allowed
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
};
