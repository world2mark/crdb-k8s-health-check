

// Path: /Users/markzlamal/Documents/PlatformHealthCheck/test-bundle-01



import EJS from 'ejs';

import YAML from 'yaml';


import PATH from 'path';
import FS, { fstatSync } from 'fs';


function GetYAMLPathFromArguments() {
    if (process.argv.length !== 3) {
        console.log('K8s: Platform Heath Check - v01');
        console.log('Usage:');
        console.log('node . <path to folder containing YAML files>');
        process.exit();
    };

    return process.argv[2];
};


const RootPathToYAML = GetYAMLPathFromArguments();


console.log(`Processing YAML in the folder \'${RootPathToYAML}\'`);


const AllFiles = FS.readdirSync(RootPathToYAML);

const YAMLFiles = AllFiles.filter(fileName => {
    const fullFilePath = PATH.join(RootPathToYAML, fileName);
    const fileStats = FS.statSync(fullFilePath);
    if (fileStats.isFile()) {
        return fileName.toUpperCase().endsWith('.YAML');
    };
});


console.log(`Processing ${YAMLFiles.length} YAML files in this folder...`);
