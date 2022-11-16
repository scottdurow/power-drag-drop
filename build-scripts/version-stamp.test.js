console.debug(`Testing Versioning ${process.cwd()}`);
const versionStamp = require('./version-stamp');
const workspacePath = process.cwd();
versionStamp({
    majorVersion: 1,
    minorVersion: 1,
    buildVersion: 2,
    manifestsPaths: [
        `${workspacePath}/code-component/PowerDragDrop`
    ],
    solutionPaths: `${workspacePath}/Solution/src/Other/Solution.xml`
});
