export class Repository {
    fullname = "";
    homeUrl = "";
    baseUrl = "";
    commitsUrl = "";
    stars = 0;
    commits = [];
}

export class RepositorySet {
    repositories = [];

    addRepository(r) {
        this.repositories.push(r);
        return this.repositories.length;
    }

    isEmpty() {
        return this.repositories.length == 0;
    }

    popRepository() {
        return this.repositories.pop();
    }

    length() {
        return this.repositories.length;
    }

    getRepositories() {
        return this.repositories;
    }
}

export class Commit {
    message = "";
    url = "";
    files = [];
}

export class File {
    filename = ""
    blobUrl = ""
    contentsUrl = ""
    patch = ""
    status = ""
}