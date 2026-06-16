# Public/Private Repository Structure

## Overview

The structure that enables grids to be OSS and deployed to a production environment involves three reposistories: the
public repository (public), the production repository (private), and the devops respository (private). The following
describes the roles of these three repositories and how they work together.

## Public Repo

The public repo serves as the source of truth for the majority of the code for grids. The exceptions to this are
the infrastructure files (like firestore.rules and vercel.json) and the production-only github workflows (like deploying
firebase functions). This means most development and all contributions flow through the public repo.

All ordinary work should happen in the public repository. Branches, PRs, forks, and contributions should all occur here,
both for the internal dev team and for public contributions.

As an OSS, this repository gives the public access to grids. It can serve as a locally-spun up version using
`npm run dev`, which will default to in-memory implementions, or as a platform for developing and contributing
to the project. It supports setting up and running Firebase emulators which do not inherit from or connect to
the live Firebase implementation.

## Production repo

The production repo, for the most part, is a copy of the public repo and is kept in sync through its own workflows.
However, the production repo has infrastructure files that are committed to the remote. As such, the production repo
is kept private. The production repo serves as where our production environments (Vercel and Firebase) deploy from.

To enable development to mainly remain in the public repository, the `infra-sync` tool allows internal developers to
work on gitignored files in their local environment and then sync them to the production repository without them
having to clone or work in the production repository. 

The production repository also owns production-specific workflows that are unnecessary in the public repository.

## Devops repo

The devops repo serves as a source of truth for the infrastructure files, as well as storing tooling like 
the `infra-sync` tool. When internal developers use the `infra-sync` tool, it also syncs file changes to this repository.
