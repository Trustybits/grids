# Dev Setup

This guide is meant for the internal dev team, and does not apply to contributors.

## Initial Setup

First, run `npm install` to install dependencies in the project.

```bash
npm install
```

Next, you will need to install and use the `infra sync` tool to get access to the infrastructure files
used for deployment. You will need access to both the internal devops repository as well as the production
repository. Once you have access to those repositories, install the command line utility `gh`, which is the
GitHub CLI.

Run the following commands:

```bash
gh auth login
```

```bash
npm run infra:setup
```

```bash
npm run infra:new
```

These commands will install the `infra sync` tool and download the necessary infrastructure files. These infrastructures
files are gitignored in this repo and should not be committed. For more information on these commands, see the 
[infra-sync notes](./infra-sync.md).

With these files installed, you may now run the dev server:

```bash
npm run dev
```

Running the dev server in this manner will connect it to the live Firebase deployment.


## Emulators

If you would like to run the dev server connected to Firebase emulators, and not the live deployment, do the
following. Do **NOT** run `npm run emulators:setup`. This will overwrite the infrastructure files just installed.

First, ensure `firebase-tools` is installed, which can be done with this command:

```bash
npm install -g firebase-tools
```

This will give you access to the firebase CLI. You will also need to install a JDK if you do not already
have one. Instructions for this vary depending on what machine you are on. Mac users can use Homebrew,
Windows users can use `winget` or Chocolately.

Once you have those installed, you can run:

```bash
npm run emulators
```

And then in a separate terminal:

```bash
npm run dev:emulators
```

This will start the dev environment connected to the Firebase emulators instead of the live Firebase deployment.

## Syncing your work

You should do all of you work in *this* repository, using branches and PRs. However, at some point your work may require
you to update or change the infrastructure files installed earlier, which are gitignored. This is where the `infra-sync` tool
comes into play.

To pull the latest infrastructure changes, run:

```bash
npm run infra:pull
```

To see the details of which infrastructure files have changed, run:

```bash
npm run infra:status
```

To sync your changes with the devops and private production repositories, use:

```bash
npm run infra:sync
```

Further details about these and other commands can be found in the [infra sync documentation](./infra-sync.md).
