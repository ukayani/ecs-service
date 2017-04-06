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

Instead of having a separate CF template per environment, the idea is to have a single
template which works across all environments. Because the tool lets you supply
parameters and environment variables to your docker container, your stack template can
remain the same between environments.

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

**AWS Credentials**

The tool will use the standard credential chain used by other aws cli tools.

If you wish to supply credentials manually see [Options](#aws-credentials)

# Supported Commands

## Deploy Service

To create or update an existing service you must provide:

- **stackname** - The name of the service you wish to create (this will be the name of the CF Stack)
- **version**
    - The version of the service you wish to run. This version should exist in your backing docker repository as a tag.
    - If you do not wish to change the running version specify `current` as the version. (Only applicable for existing services)
- **template file** - A JSON Cloud Formation template containing your ECS Service and Task Definition
- **parameter file** - A file containing a key value JSON object which maps your template parameter's to their values.

To deploy the service, use the following command:

```bash
$ ecs-service deploy [stackname] [version] [template_file] [params_file]
```

This command will create/update a CF stack with the provided `stackname` and supply the service version via the `AppVersion` parameter.
For the remaining non-default parameters, it will use the `parameter file`.

The command will wait until the successful creation/update of the stack.

### Supplying Environment Variables to your docker service

If your docker service is configured via Environment Variables you must
supply them via the TaskDefinition's Container Definition's [Environment](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definition_environment) property.
This can be tedious to update when your environment variables change.

`ecs-service` allows you to supply a `env` file when creating/updating services which
will be used to populate the Container Definition's Environment property.

The `--env-file` parameter can be used to supply an `env` file containing all of
your environment variables.

**Example ENV file**

```bash
EXTERNAL_SERVICE_URI=http://api.myservice.com
FOO=test
BAR=blah
```

Each line defines an environment variable.

**Example Usage**

Using the `--env-file` parameter, you can supply a `env` file which will be used to pass environment variables to your container.

```bash
$ ecs-service deploy [stackname] [version] [template_file] [params_file] --env-file <file>
```

This parameter can be used with any of the commands provided.

## Update Service

If you need to run a new version of your service or update environment variables you can use the simpler `run` command.
Instead of having to provide a template and parameter files you can use this command if you only need to adjust the version
or [scale](#setting-the-scale-for-your-service) of your service.

This command requires:

- **stackname** - The name of the existing service stack.
- **version**
    - The version label for the service. A corresponding tag should exist in your docker registry.
    - If you do not wish to change the running version specify `current` as the version.

```bash
$ ecs-service update [stackname] [version]
```

This command will update your ecs service to use the specified version of your container image.

### Environment Variables

As mentioned under the [Deploy](#supplying-environment-variables-to-your-docker-service) command, you can use the `--env-file` parameter to supply a file containing
environment variables for your container.

## Stop Service

To stop a service, you can issue the `stop` command which will set the *desired count* of your service to 0.

```bash
$ ecs-service stop [stackname]
```

**Note**: this will not remove/delete your ECS service or Task Definition.

## Destroy Service

To completely remove the resources associates with your service stack you can use the `destroy` command.

This command will result in a stack deletion operation.

```bash
$ ecs-service destroy [stackname]
```

# Optional Parameters

### Setting the scale for your service

To specify the number of instances of your service to run, use the `--scale` parameter.

**Example**

To run two instances of an existing service called `myservice` we can issue the following command:

```bash
$ ecs-service update myservice 0.1.0 --scale 2
```

### Specifying AWS Tags for the service stack

If you need your service stack to have associated tags, you can do so via the `--tag-file` parameter.

**Example**

A tag file is a JSON file with an object where the keys are names of tags to create and values are the tag values.

*Example Tag File - tags.json*

```json
{
    "Owner": "Alice",
    "Project": "Top Secret"
}
```

Given the above tag file we can provide it via the `--tag-file` command as follows:

```bash
$ ecs-service deploy myservice 0.1.0 service.json params.json --tag-file tags.json
```

The above command will create `myservice` using the template in `service.json` with the tags `Owner=Alice` and `Project=Top Secret`

### AWS Credentials

To supply credentials manually you can use the following parameters:

- **--access-key-id** - To specify your access key ID
- **--secret-access-key** - To specify your secret
- **--region** - To specify the AWS Region

**Using Profiles**

Alternatively you can supply an AWS credential profile to use via:

- **--profile** - To use a credential profile instead of supplying access key and secret
