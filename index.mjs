

// Customer demo
// Path: /Users/markzlamal/Documents/PlatformHealthCheck/test-bundle-01
// Auracoda 6-node cluster
// Path: /Users/markzlamal/Documents/PlatformHealthCheck/test-bundle-02



import EJS from 'ejs';

import YAML from 'yaml';


import PATH from 'path';
import FS from 'fs';


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

const PlatformFiles = AllFiles.filter(fileName => {
    const fullFilePath = PATH.join(RootPathToYAML, fileName);
    const fileStats = FS.statSync(fullFilePath);
    return fileStats.isFile();
});


console.log(`Processing ${PlatformFiles.length} YAML files in this folder...`);


const PlatformData = PlatformFiles.map(fileName => {
    const fileObj = {
        FileName: fileName,
        FilePath: PATH.join(RootPathToYAML, fileName)
    };

    fileObj.FileData = FS.readFileSync(fileObj.FilePath, 'utf8');

    if (fileName.toUpperCase().endsWith('.YAML')) {
        fileObj.FileJSON = YAML.parse(fileObj.FileData);
    };

    return fileObj;
});


const TXTFileObj = PlatformData.find(item => item.FileName.startsWith('roachdiag-k8s.'));
const TXTFileLines = TXTFileObj.FileData.split('\n');



// https://regex101.com
function FilterSpecificFiles(pData, filterString) {
    const fileRegEx = new RegExp(`^${filterString.replace(/\*/g, '.*')}$`);
    return pData.filter(fileItem => fileRegEx.test(fileItem.FileName));
};


function CaptureDataGeneric(pData, filePattern, xPath) {
    const myResults = [];

    const targetFiles = FilterSpecificFiles(pData, filePattern);

    for (const objectData of targetFiles) {
        let myDataInPath = objectData.FileJSON;
        for (const patternKey of xPath) {
            myDataInPath = myDataInPath[patternKey];
            if (!myDataInPath) {
                console.log(`Data does not exist in file \'${objectData.FileName}\': \'${xPath}\'`);
            };
        };
        myResults.push(myDataInPath);
    };

    return myResults;
};


function CaptureEnvProviders(pData) {
    const providerIDs = [];
    const ResultObj = {
        Comments: 'Good',
        Value: []
    };

    const AllWorkers = CaptureDataGeneric(pData, 'node*.yaml', []);

    // round 1: capture all workers & providers
    for (const myWorker of AllWorkers) {
        providerIDs.push({
            WorkerName: myWorker.metadata.name,
            ProviderID: myWorker.spec.providerID
        });
    };

    // round 2: match all inconsistencies
    for (let leftIndex = 0; leftIndex < providerIDs.length; leftIndex++) {
        let isConsistent = true;
        const leftProvider = providerIDs[leftIndex].ProviderID.split(':///');
        for (let rightIndex = 0; rightIndex < providerIDs.length; rightIndex++) {
            if (leftIndex !== rightIndex) {
                const rightProvider = providerIDs[rightIndex].ProviderID.split(':///');
                if (leftProvider[0] !== rightProvider[0]) {
                    isConsistent = false;
                    ResultObj.Warning = true;
                    break;
                };
            } else {
                ResultObj.Comments = `Good: ${leftProvider[0].toUpperCase()}`
            };
        };
        if (isConsistent) {
            ResultObj.Value.push(`<span class=\"fragHeavy\">${providerIDs[leftIndex].ProviderID}</span><span class=\"fragLight\"> ${providerIDs[leftIndex].WorkerName}</span>`);
        } else {
            ResultObj.Comments = 'Mismatched Providers';
            ResultObj.Value.push(`<span class=\"fragRedHeavy\">${providerIDs[leftIndex].ProviderID}</span><span class=\"fragRedLight\"> ${providerIDs[leftIndex].WorkerName}</span>`);
        };
    };

    return ResultObj;
};


function CaptureOSs(pData) {
    const theOSs = CaptureDataGeneric(pData, 'node*.yaml', ['status', 'nodeInfo', 'operatingSystem']);
    const theImages = CaptureDataGeneric(pData, 'node*.yaml', ['status', 'nodeInfo', 'osImage']);
    const OSList = [];
    for (let index = 0; index < theOSs.length; index++) {
        OSList.push(`${theOSs[index]} (${theImages[index]})`)
    };
    return OSList;
};


function CaptureKernelVersions(pData) {
    return CaptureDataGeneric(pData, 'node*.yaml', ['status', 'nodeInfo', 'kernelVersion']);
};


function CaptureKubeletVesion(pData) {
    return CaptureDataGeneric(pData, 'node*.yaml', ['status', 'nodeInfo', 'kubeletVersion']);
};


function CaptureDockerVesion(pData) {
    return CaptureDataGeneric(pData, 'node*.yaml', ['status', 'nodeInfo', 'containerRuntimeVersion']);
};



function CaptureAllPods(pData) {
    const myPods = {
        CRDB: [],
        NonCRDB: []
    };

    const podList = CaptureDataGeneric(pData, 'pod*.yaml', []);
    for (const thePod of podList) {
        for (const myContainer of thePod.spec.containers) {
            if (myContainer.image.includes('cockroachdb/cockroach:')) {
                if (thePod.spec.containers.length !== 1) {
                    throw new Error('CockroachDB pods must have a single container driving the node');
                };
                myPods.CRDB.push(thePod);
                break;
            } else {
                myPods.NonCRDB.push(thePod);
                break;
            };
        };
    };

    return myPods;
};


function CaptureWorkerNodes(pData) {
    const WorkerNodeList = CaptureDataGeneric(pData, 'node*.yaml', []);
    const CleanList = WorkerNodeList.map(item => ({
        WorkerName: item.metadata.name,
        InstanceType: item.metadata.labels['node.kubernetes.io/instance-type']
    }));
    return CleanList;
};


function CaptureVolumes(pData) {
    const fullPVCDetails = CaptureDataGeneric(pData, 'persistentvolume*.yaml', ['items']);
    return fullPVCDetails[0].map(item => item.spec);
};


function DeepEqual(x, y) {
    if (x === y) {
        return true;
    } else if ((typeof x == "object" && x != null) && (typeof y == "object" && y != null)) {
        if (Object.keys(x).length != Object.keys(y).length) {
            return false;
        };

        for (var prop in x) {
            if (y.hasOwnProperty(prop)) {
                if (!DeepEqual(x[prop], y[prop])) {
                    return false;
                };
            } else {
                return false;
            };
        };

        return true;
    };
};


function PassAsIs(myArrayObj) {
    return {
        Value: myArrayObj,
        Comments: 'Good'
    };
};


function ValidateIdentical(myArrayObj) {
    for (let leftIndex = 0; leftIndex < myArrayObj.length - 1; leftIndex++) {
        for (let rightIndex = leftIndex + 1; rightIndex < myArrayObj.length; rightIndex++) {
            const leftObj = myArrayObj[leftIndex];
            const rightObj = myArrayObj[rightIndex];
            if (!DeepEqual(leftObj, rightObj)) {
                return {
                    Warning: true,
                    Comments: 'Inconsistent',
                    Value: myArrayObj
                };
            };
        };
    };
    return {
        Comments: 'Good',
        Value: [myArrayObj[0]]
    };
};


const ObjectList = [];


const MyEnvProviders = CaptureEnvProviders(PlatformData);
ObjectList.push({
    Header: 'Provider',
    Results: MyEnvProviders
});

const MyOSs = CaptureOSs(PlatformData);
ObjectList.push({
    Header: 'OS',
    Results: ValidateIdentical(MyOSs)
});

const MyKernelVersions = CaptureKernelVersions(PlatformData);
ObjectList.push({
    Header: 'Kernel Versions',
    Results: ValidateIdentical(MyKernelVersions)
});

const KubeletVersion = CaptureKubeletVesion(PlatformData);
ObjectList.push({
    Header: 'Kubelet Version',
    Results: ValidateIdentical(KubeletVersion)
});

const DockerVersion = CaptureDockerVesion(PlatformData);
ObjectList.push({
    Header: 'Docker Version',
    Results: ValidateIdentical(DockerVersion)
});




function WorkerNodeResults(workers) {
    const HTML = [];

    let dataIsConsistent = true;
    for (let workerNodeIndex = 0; workerNodeIndex < workers.length; workerNodeIndex++) {
        const InstanceType = workers[workerNodeIndex].InstanceType;
        HTML.push(`<span class=\"fragHeavy\">${InstanceType}</span><span class=\"fragLight\"> ${workers[workerNodeIndex].WorkerName}</span>`);
        if (workers[0].InstanceType !== InstanceType) {
            dataIsConsistent = false;
        };
    };

    if (dataIsConsistent) {
        return {
            Comments: 'Good',
            Value: HTML
        };
    } else {
        return {
            Warning: true,
            Comments: 'Instance Type Mismatch',
            Value: HTML
        };
    };
};

const WorkerNodes = CaptureWorkerNodes(PlatformData);

ObjectList.push({
    Header: 'Worker Nodes',
    Results: WorkerNodeResults(WorkerNodes)
});




function CRDBPodResults(pods) {
    const usedWorkers = [];
    const HTML = [];
    const InconsistentWorkers = [];
    let dataIsConsistent = true;

    // round 1: capture any inconsistencies
    for (const crdbPod of pods) {
        if (usedWorkers.find(workerName => workerName === crdbPod.spec.nodeName)) {
            InconsistentWorkers.push(crdbPod.spec.nodeName);
            dataIsConsistent = false;
        };
        usedWorkers.push(crdbPod.spec.nodeName);
    };

    // round 2: flag the inconsistencies via HTML
    for (const crdbPod of pods) {
        if (InconsistentWorkers.find(nodeName => nodeName === crdbPod.spec.nodeName)) {
            HTML.push(`<span class=\"fragRedHeavy\">${crdbPod.metadata.name}</span><span class=\"fragRedLight\"> ${crdbPod.spec.nodeName}</span>`);
        } else {
            HTML.push(`<span class=\"fragHeavy\">${crdbPod.metadata.name}</span><span class=\"fragLight\"> ${crdbPod.spec.nodeName}</span>`);
        };
    };

    if (dataIsConsistent) {
        return {
            Comments: 'Good',
            Value: HTML
        };
    } else {
        return {
            Warning: true,
            Comments: 'Worker nodes overloaded',
            Value: HTML
        };
    };
};

const AllPods = CaptureAllPods(PlatformData);

ObjectList.push({
    Header: 'CRDB Pods/Workers',
    Results: CRDBPodResults(AllPods.CRDB)
});




function ValidateCRDBVersions() {
    const ResultObj = {
        Comments: 'Good',
        Value: []
    };
    let imageTag;
    for (const crdbPod of AllPods.CRDB) {
        if (!imageTag) {
            imageTag = crdbPod.spec.containers[0].image;
        } else if (imageTag !== crdbPod.spec.containers[0].image) {
            ResultObj.Warning = true;
            ResultObj.Comments = 'Mixed versions'
        };
        const HTML = [];
        HTML.push(`<span class=\"fragHeader\">${crdbPod.metadata.name}</span>`);
        HTML.push(`<span class=\"fragHeavy\">${crdbPod.spec.containers[0].image}</span> <span class=\"fragLight\"> (${crdbPod.spec.nodeName})</span>`);
        ResultObj.Value.push(HTML.join('<br>'));
    };
    return ResultObj;
};

ObjectList.push({
    Header: 'CRDB Pod Versions',
    Results: ValidateCRDBVersions()
});



function CaptureCRDBVolumes(pData) {
    const AllPVs = CaptureVolumes(pData);

    const myVolumes = [];

    for (const thePod of AllPods.CRDB) {
        const storeVolumes = thePod.spec.volumes.filter(someVolume => someVolume.persistentVolumeClaim);
        for (const pvcObj of storeVolumes) {
            const myVolume = AllPVs.find(pvObj => pvObj.claimRef.name === pvcObj.persistentVolumeClaim.claimName);
            myVolumes.push({
                PVCName: pvcObj.persistentVolumeClaim.claimName,
                WorkerNode: thePod.spec.nodeName,
                PodName: thePod.metadata.name,
                Capacity: myVolume.capacity.storage,
                StorageClassName: myVolume.storageClassName,
                Driver: myVolume.csi.driver,
                FSType: myVolume.csi.fsType
            });
        };
    };

    return myVolumes;
};



const CRDBVolumesRaw = CaptureCRDBVolumes(PlatformData);

function ValidateVolumes() {
    const ResultObj = {
        Comments: 'Good',
        Value: []
    };
    let capacityValue;
    for (const volumeObj of CRDBVolumesRaw) {
        if (!capacityValue) {
            capacityValue = volumeObj.Capacity;
        } else if (capacityValue !== volumeObj.Capacity) {
            ResultObj.Warning = true;
            ResultObj.Comments = 'Non-uniform capacities'
        };
        const HTML = [];
        HTML.push(`<span class=\"fragHeader\">${volumeObj.PodName}</span>`);
        HTML.push(`<span class=\"fragHeavy\">${volumeObj.Capacity}</span> <span class=\"fragLight\"> (${volumeObj.WorkerNode})</span>`);
        ResultObj.Value.push(HTML.join('<br>'));
    };
    return ResultObj;
};

ObjectList.push({
    Header: 'Volume Capacity',
    Results: ValidateVolumes()
});

ObjectList.push({
    Header: 'Volume Storage Class',
    Results: ValidateIdentical(CRDBVolumesRaw.map(item => item.StorageClassName))
});

ObjectList.push({
    Header: 'Volume Driver',
    Results: ValidateIdentical(CRDBVolumesRaw.map(item => item.Driver))
});

ObjectList.push({
    Header: 'Volume FS Type',
    Results: ValidateIdentical(CRDBVolumesRaw.map(item => item.FSType))
});


const FreeSpace = [];

for (const CRDBPodObj of AllPods.CRDB) {
    let DFBlock = TXTFileLines.findIndex(
        item => item.startsWith(':::::  kubectl --namespace ') &&
            item.endsWith(` exec ${CRDBPodObj.metadata.name} -- df -h`));

    if (DFBlock >= 0) {
        const DFInfo = {
            CRDBPodName: CRDBPodObj.metadata.name,
            DFEntries: []
        };

        DFBlock += 2;
        while (!TXTFileLines[DFBlock].startsWith('=====')) {
            const trimmedData = TXTFileLines[DFBlock].trim();
            if (trimmedData.length > 0 && !trimmedData.startsWith('Defaulted container ')) {
                DFInfo.DFEntries.push(TXTFileLines[DFBlock]);
            };
            DFBlock++;
        };

        if (DFInfo.DFEntries.length > 0) {
            if (DFInfo.DFEntries[0].startsWith('Filesystem ')) {
                FreeSpace.push(DFInfo);
            };
        };
    };
};

const FreeSpacePretty = FreeSpace.map(item => {
    const HTML = [];
    HTML.push(`<span class=\"fragHeader\">${item.CRDBPodName}</span>`);
    for (const DFItem of item.DFEntries) {
        if (DFItem.startsWith('/dev/') && !DFItem.endsWith('/etc/hosts')) {
            HTML.push(`<span style=\"padding-left: 1em\" class=\"fragHeavy\">${DFItem}</span>`);
        } else {
            HTML.push(`<span style=\"padding-left: 1em\" class=\"fragLight\">${DFItem}</span>`);
        };
    };
    return HTML.join('<br>');
});

ObjectList.push({
    Header: 'Actual Capacity',
    Results: PassAsIs(FreeSpacePretty)
});








// Last item
const nonCRDBPodsPretty = AllPods.NonCRDB.map(item => {
    return `<span style=\"padding-left: 1em\" class=\"fragLight\">${item.metadata.name}</span>`;
});

ObjectList.push({
    Header: 'Non-CRDB Pods',
    Results: PassAsIs(nonCRDBPodsPretty)
});



const ResourceLimits = AllPods.CRDB.map(crdbPod => {
    const podResources = crdbPod.spec.containers[0].resources;

    if (podResources.limits) {
        const lc = podResources.limits.cpu;
        const lm = podResources.limits.memory;
        const rc = podResources.requests.cpu;
        const rm = podResources.requests.memory;

        const HTML = [];

        HTML.push(`<span class=\"fragHeader\">${crdbPod.metadata.name}</span>`);
        HTML.push(`<span class=\"fragLight\"> Resource limit (CPU/Memory): </span><span class=\"fragHeavy\">${lc}</span><span class=\"fragLight\"> / </span><span class=\"fragHeavy\">${lm}</span>`);
        HTML.push(`<span class=\"fragLight\"> Resource requests (CPU/Memory): </span><span class=\"fragHeavy\">${rc}</span><span class=\"fragLight\"> / </span><span class=\"fragHeavy\">${rm}</span>`);
        return HTML.join('<br>');
    } else {
        return `<span class=\"fragHeader\">${crdbPod.metadata.name}</span><br><span class=\"fragLight\"> None</span>`;
    };
});

ObjectList.push({
    Header: 'CRDB Resource Limits',
    Results: PassAsIs(ResourceLimits)
});



function QoSClass() {
    const resultObj = {
        Comments: 'Good',
        Value: []
    };

    let qosTest;

    for (const crdbPod of AllPods.CRDB) {
        if (!qosTest) {
            qosTest = crdbPod.status.qosClass;
        };
        if (qosTest !== crdbPod.status.qosClass) {
            resultObj.Warning = true;
            resultObj.Comments = 'Inconsistent'
        };

        const HTML = [];
        HTML.push(`<span class=\"fragHeader\">${crdbPod.metadata.name}</span>`);
        HTML.push(`<span class=\"fragHeavy\"> ${crdbPod.status.qosClass}</span>`);
        resultObj.Value.push(HTML.join('<br>'));
    };

    return resultObj;
};

ObjectList.push({
    Header: 'QoS Class',
    Results: QoSClass()
});





const AntiAffinity = AllPods.CRDB.map(CRDBPod => {
    return {
        PodName: CRDBPod.metadata.name,
        WorkerNode: CRDBPod.spec.nodeName,
        AntiAffinity: CRDBPod.spec.affinity
    };
});

function ValidateAntiAffinity() {
    const resultObj = {
        Comments: 'Good',
        Value: []
    };

    let testAff;

    for (const podAff of AntiAffinity) {
        const HTML = [];
        HTML.push(`<span class=\"fragHeader\">${podAff.PodName}</span>`);
        if (podAff.AntiAffinity) {
            if (!testAff) {
                testAff = podAff.AntiAffinity;
            };
            if (!DeepEqual(podAff.AntiAffinity, testAff)) {
                resultObj.Warning = true;
                resultObj.Comments = 'Inconsistent';
            };
            HTML.push(`<span class=\"fragLight\"> ${JSON.stringify(podAff.AntiAffinity.podAntiAffinity, 0, 2)}</span>`);
        } else {
            HTML.push(`<span class=\"fragLight\"> None</span>`);
        };
        resultObj.Value.push(HTML.join('<br>'));
    };

    return resultObj;
};

ObjectList.push({
    Header: 'Anti-Affinity',
    Results: ValidateAntiAffinity()
});





const WorkerNodesRaw = CaptureDataGeneric(PlatformData, 'node*.yaml', []);

function ValidateNodeTaints() {
    const resultObj = {
        Comments: 'Good',
        Value: []
    };
    
    let taintList;

    for(const workerNode of WorkerNodesRaw) {
        const HTML = [];

        HTML.push(`<span class=\"fragHeader\">${workerNode.metadata.name}</span>`);
        if (workerNode.spec.taints) {
            if (!taintList) {
                taintList = workerNode.spec.taints;
            };
            if (!DeepEqual(taintList, workerNode.spec.taints)) {
                resultObj.Warning = true;
                resultObj.Comments = 'Inconsistent';
            };
            HTML.push(`<span class=\"fragLight\"> ${JSON.stringify(workerNode.spec.taints, 0, 2)}</span>`);
        } else {
            HTML.push(`<span class=\"fragLight\"> None</span>`);
        };
        resultObj.Value.push(HTML.join('<br>'));
    };

    return resultObj;
};

ObjectList.push({
    Header: 'Node Taints',
    Results: ValidateNodeTaints()
});






const HeaderList = [];

const RunDateHeaderIndex = TXTFileLines.findIndex(item => item.includes('* Cockroach DB Kubernetes Cluster Configuration Report *'));
const RunDateLine = TXTFileLines[RunDateHeaderIndex + 1];
const RunDateLineClean = RunDateLine.replaceAll('*', '').trim();
HeaderList.push({
    Key: 'RoachDiag Run date',
    Value: RunDateLineClean
});

HeaderList.push({
    Key: 'Path to diagnostics files',
    Value: RootPathToYAML
});

const k8sContextHeaderIndex = TXTFileLines.findIndex(item => item.includes(':::::  kubectl config current-context'));
HeaderList.push({
    Key: 'Kubernetes namespace &amp; context',
    Value: TXTFileLines[k8sContextHeaderIndex + 2]
});


const EJSString = FS.readFileSync(PATH.join(import.meta.dirname, 'results.ejs'), 'utf8');
const resultHTML = EJS.render(EJSString, {
    HeaderList,
    ObjectList
});

FS.writeFileSync(PATH.join(import.meta.dirname, 'results.html'), resultHTML);

console.log('App completed');
