# ECS Service

## Overview

This tool aims to simplify the deployment of docker-based services on
Amazon's ECS platform.

## How it works

Creation/deployment of ECS services is backed by AWS Cloud Formation.

Every command in the tool maps to a stack operation in Cloud Formation.

To use `ecs-service` you need to use a Cloud Formation template
which creates an ECS service along with a Task Definition.

When creating your service, you must supply this template along with
the version of the service you wish to run. The tool will create a
CF stack with the name you provide.

After the service is created, you can issue commands to update the running
version of the service which will result in a stack update.

# Requirements

- NodeJS v6.x or newer
- A Cloud formation template with an ecs service and task definition defined
    - Required template parameters:
        1. `AppVersion` - Must be defined so the version of the service can be supplied by `ecs-service`
        2. `AppDesiredCount` - Must be defined so the number of instances can be supplied by `ecs-service`
- An AWS user/role which has permissions to:
    - DescribeStack
    - GetTemplate
    - UpdateStack
    - CreateStack
    - DeleteStack

# Installation

```bash
npm install -g ecs-service
```

**AWS REGION**

You must export the AWS region you are deploying your service to,
or supply it via the `-r` parameter.

```bash
export AWS_REGION=us-east-1
```

# Supported Commands

## Create Service

## Update Service

## Run Service

## Stop Service

## Destroy Service

