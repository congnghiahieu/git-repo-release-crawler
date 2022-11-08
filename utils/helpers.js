import {
    API_NOT_EXIST_MSG,
    CHANGELOG_NO_INFO,
    FETCH_ERR_MSG,
    RELEASE_INFO_MSG,
    github,
    githubApi,
    crawlError,
    loader,
} from './constants.js';

import parseMdToHtml from './mdToHtml.js';

// Kiểm tra link github repo có hợp lệ
export function isValidGitRepo(string) {
    // https://github.com/mastodon/mastodon
    // regex: /^https:\/\/github.com\/\w+\/\w+$/ to test is github repo URL

    return /^https:\/\/github.com\/\w+\/\w+$/.test(string);
}

export async function getFullReleases(source) {
    let releases = [];

    // Note: Each release api can get max 100 releases
    for (let pageNumber = 1; pageNumber <= 10; pageNumber++) {
        const releasesApi = getReleaseApi(source, pageNumber);

        let data = await fetchReleaseApi(releasesApi);

        releases = [...releases, ...data];

        // Nếu lần đầu (hoặc lần sau) lấy được < 100 release => đã lấy được full
        if (data.length < 100) break;
    }

    return releases;
}

export async function getFullCommits(source, prevRelease, curRelease) {
    // Get total quantity and commits from data api
    // Note: Each compare api get max 250 commits
    // Lấy diff commit từ compare api đầu tiên
    const compareApi = getCompareApi(source, 1, prevRelease, curRelease);
    let fullCommits = [];
    const { total, data, api: comApi, html: comHtml } = await fetchCompareApi(compareApi);
    fullCommits = [...fullCommits, ...data];

    console.log('Total của lần gọi compare page 1 ', total);
    console.log('Data của lần compare page 1', data.length);

    // Nếu còn commit chưa lấy hết thì promise all để lấy toàn bộ api còn lại
    if (total > 250) {
        const numRemainComparePage = Math.ceil((total - 250) / 250);
        console.log('Số lượng compare api còn lại ', numRemainComparePage);
        let dumb = [];
        for (let i = 1; i <= numRemainComparePage; i++) {
            dumb.push(1);
        }

        await Promise.all(
            dumb.map((val, index) => {
                return fetchCompareApi(getCompareApi(source, 2 + index, prevRelease, curRelease));
            })
        )
            .then(responses => {
                responses.forEach(response => {
                    const { data: commits } = response;
                    fullCommits = [...fullCommits, ...commits];
                });
            })
            .catch(err => {
                console.log(err);
            });

        console.log('Total sau khi call hết compare api ', total);
        console.log('Tổng số lượng data khi call hết compare api ', fullCommits.length);
        if (total !== fullCommits.length) {
            console.warn('Số lượng commits không khớp ! Vui lòng kiểm tra lại');
        }
    }

    return {
        fullCommits: fullCommits,
        comApi: comApi,
        comHtml: comHtml,
    };
}

// Dải html của release vào DOM
export function appendRelease(list, curRelease) {
    const releaseLi = document.createElement('li');
    releaseLi.classList.add('result-item', 'rel');
    releaseLi.innerHTML = getReleaseInfo(curRelease);
    list.appendChild(releaseLi);
}

// Dải html của compare commit vào DOM
export function appendCommit(list, commits, prevRelease, curRelease, diffComApi, diffComHtml) {
    const html = getCommitsInfo(commits);
    const difComLi = document.createElement('li');
    difComLi.classList.add('result-item', 'com');
    difComLi.innerHTML = `
        <div class="com-summary">
            <div class="com-compare">
                <p>
                    Base: ${curRelease.tag_name}
                    <span>
                    <i class="fa-solid fa-arrow-left-long"></i>
                    </span>
                    compare:${prevRelease.tag_name}
                </p>
            </div>
            <div class="com-diff-url">
                <a href=${diffComApi} target="_blank">Diff API</a>
                <a href=${diffComHtml} target="_blank">Diff HTML</a>
            </div>
            <button class="com-btn" onclick="handleShow(this)">Show detail list</button>
        </div>
        <ul class="com">
            ${html}
        </ul>
    `;
    list.appendChild(difComLi);
}

export function getReleaseApi(source, pageNumber) {
    return `${githubApi}/repos${source.slice(
        github.length
    )}/releases?per_page=100&page=${pageNumber}`;
}

export function getCompareApi(source, pageNumber, prevRelease, curRelease) {
    return `${githubApi}/repos${source.slice(github.length)}/compare/${prevRelease.tag_name}...${
        curRelease.tag_name
    }?page=${pageNumber}`;
}

export async function fetchReleaseApi(api) {
    console.log('Dang fetch den api: ', api);
    let data;
    await fetch(api, {
        method: 'GET',
        headers: {
            Authorization: 'Token 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',
            Accept: 'application/vnd.github+json',
        },
    })
        .then(response => {
            // Check response
            if (response.ok) {
                console.log(api);
                return response.json();
            } else {
                showErr(api, FETCH_ERR_MSG);
                clearChilden(loader);
                throw new Error(FETCH_ERR_MSG + api);
            }
        })
        .then(releases => {
            // Check xem repo có releases hay không
            if (releases.length === 0) {
                showErr('', RELEASE_INFO_MSG);
                clearChilden(loader);
                throw new Error(RELEASE_INFO_MSG);
            }
            if (releases.message === 'Not Found') {
                showErr(api, API_NOT_EXIST_MSG);
                clearChilden(loader);
                throw new Error(RELEASE_INFO_MSG);
            }
            data = releases;
        });

    return data;
}

export async function fetchCompareApi(api) {
    console.log('Dang goi den api: ', api);
    let result;
    await fetch(api, {
        method: 'GET',
        headers: {
            Authorization: 'Token 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',
            Accept: 'application/vnd.github+json',
        },
    })
        .then(res => {
            if (res.ok) return res.json();
            else {
                showErr(api, FETCH_ERR_MSG);
                clearChilden(loader);
                throw new Error(FETCH_ERR_MSG + api);
            }
        })
        .then(json => {
            result = {
                total: json.total_commits,
                data: json.commits,
                api: json.url,
                html: json.html_url,
            };
        })
        .catch(err => {
            showErr(api, FETCH_ERR_MSG);
            clearChilden(loader);
            throw new Error(FETCH_ERR_MSG + api);
        });

    return result;
}

export function showErr(link, msg) {
    const div = document.createElement('div');
    div.classList.add('error');
    div.innerHTML = `
        <span>${msg} <a href=${link} target="_blank">${link}</a></span>
    `;
    crawlError.appendChild(div);
}

export function getReleaseInfo(release) {
    const apiUrl = release.url;
    const htmlUrl = release.html_url;
    const tagName = release.tag_name;
    const isPrerelease = release.prerelease;
    const createdAt = new Date(release.created_at).toLocaleDateString();
    const publishAt = new Date(release.published_at).toLocaleDateString();
    const changeLog = modifyChangeLog(release.body);

    return `
    <div class="rel-sum">
        <div class="rel-version">
            <p>${isPrerelease ? 'Prerelease: ' : 'Version: '}${tagName}</p>
        </div>
        <div class="rel-time">
            <p class="">Created: ${createdAt}</p>
            <p class="">Published: ${publishAt}</p>
        </div>
    </div>
        <div class="rel-log">
            <span>Change log:</span>
            <div class="log-content">
                ${changeLog}
            </div>
        </div>
        <div class="rel-url">
            <a href=${apiUrl} class="rel-url-api" target="_blank">Release API</a>
            <a href=${htmlUrl} class="rel-url-html" target="_blank">Release Page</a>
        </div>
    `;
}

export function getCommitsInfo(commits) {
    const htmls = commits
        .map((commit, index) => {
            const hash = commit.sha;
            const commitApiUrl = commit.url;
            const commitHtmlUrl = commit.html_url;
            const message = commit.commit.message.trim();
            const name = commit.commit.committer.name.trim();
            const date = new Date(commit.commit.committer.date).toLocaleDateString();

            return `
                <li class="com-item">
                    <div class="com-info">
                        <p class="com-comment">Commit's comment: ${message}</p>
                        <p class="com-date">Commit's date: ${date}</p>
                        <p class="com-name">Commit's commiter: ${name}</p>
                        <p class="com-hash">Commit's hash code: ${hash}</p>
                    </div>
                    <div class="com-url">
                    <a href=${commitApiUrl} class="com-url-api" target="_blank">Commit API</a>
                    <a href=${commitHtmlUrl} class="com-url-html" target="_blank">Commit Page</a>
                </div>
                </li>`;
        })
        .reverse()
        .join('');

    return htmls;
}

function modifyChangeLog(changeLog) {
    if (!changeLog) return CHANGELOG_NO_INFO;
    // Convert html tag to plain text
    // .replace(/</g, '&lt').replace(/>/g, '&gt').trim();
    let res = parseMdToHtml(changeLog);
    return res;
}

// Clear các element cũ cho lần crawl tiếp theo
export function clearChilden(parentElement) {
    Array.from(parentElement.childNodes).map(child => child.remove());
}
