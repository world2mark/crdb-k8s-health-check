# CockroachDB K8s Platform Health Check Automation

This service automates & summarizes the analysis of YAML files that are captured/collected using the **roachdiag-k8s.sh** script.

## What is a Health Check offered by Cockroach Labs

The **Health Check** package from Cockroach Labs meticulously covers platform and sizing review, operational readiness and application architecture review of a database cluster. This service is delivered as an iterative & interactive process that dives into your DB requirements, use-cases, infrastructure organization, and app deployments to address any risk-factors, and to ensure your cluster is future-proof, scalable, tuned for schema & query optimization, and security considerations.

Topics that are discussed may include:

- Database organization
- Regionality & data locality
- Schemas and tables
- Primary key definitions & constraints
- Load balancers, Connection Pools, physical DB and app deployments, plus many other other infrastructure considerations, dependent on the ecosystem.
- Network considerations tied to multi-region, on-prem, or hybrid environments.
- Access control and users/roles/grants
- Security, certificates, and network permissions
- Workload sizing
- Schedules, backups, CDC
- Prometheus monitoring and alerting on thresholds being breached

The primary focus here is the review of CockroachDB on Kubernetes-based platforms
These may include self-managed or fully-managed deployments, OpenShift deployments, on-premise or in-cloud deployments.

## Scope of this repository: "roachdiag-k8s.sh"
One of the steps of a _platform health check_ is running a shell-script against your current K8s context, named **roachdiag-k8s.sh**. This script interrogates your kubernetes cluster where an existing CockroachDB deployment resides. It captures metadata related to the pods, worker-nodes, networking characteristics, and various services and properties of the infrastructure.

While local IPs and service names are captured in this process, **no database data is collected during this process**.

Because this interrogation process is exhaustive, it captures many (potentially 100s) YAML files that represent the entities of the provisioned K8ts objects.
Exploring, inspecting/analyzing, summarizing, and making sense sense of all these files was extremely tedious, error-prone, and unreliable because each CockroachDB deployment may have unique naming conventions or other customized properties.

This application helps remove this burden by sifting away noise, highlighting key fragments, capturing uniqueness or identities as needed, flagging any inconsistencies on your behalf.

## What to do with this data?

The most important factor of this service is engagement with the customer.

The health-report summaries of this application are to be discussed with the customer, akin to discussing physical health topics with a real doctor at a clinic.  Not every "inconsistency" should be seen as a negative, but should be noted for awareness and risk acceptance if it does in-fact pose any risk.

Customer probing and workload expectations play a role in what areas need attention or what areas can be dismissed or accepted into a production environment.

## Prerequisites

1. This is a nodejs application.  You will need the node environment installed
2. Libraries required: **ejs**, **yaml**
3. It is the responsibility of the user to run the **roachdiag-k8s.sh** script to completion.

## Usage

1. Unzip the tar generated file into a folder that you have access to (_tar xvf filename_).  Note this location, eg: **/Users/markzlamal/Documents/PlatformHealthCheck/zone-1**
2. Run the following _nodeJS_ command to run this application, targeting the uzipped folder, eg: **node . /Users/markzlamal/Documents/PlatformHealthCheck/zone-1**
3. This will read the files in the folder and generate an HTML file result, named using the **NameSpace**.**timestamp**.html, eg: _zone-1.mark.1736949886188.html_
4. Open this file in your browser, and review the captured data with your customer.

## Examples of output

In the examples folder of this repository, you can see some examples of deployments and what to expect as possible outputs.
