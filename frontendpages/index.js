const fs = require('fs');
const path = require('path');

module.exports = async function (context, req) {
    const page = req.query.page;  // Example: login, register, employee, etc.

    // If no page given, default to welcome.html
    const fileName = page ? `${page}.html` : 'welcome.html';

    // Correctly point to the frontend folder
    const filePath = path.join(__dirname, '../frontend', fileName);

    try {
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        context.res = {
            headers: { 'Content-Type': 'text/html' },
            body: htmlContent
        };
    } catch (error) {
        context.res = {
            status: 404,
            body: 'Page not found'
        };
    }
}
