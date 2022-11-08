import {
    FETCH_ERR_MSG,
    INVALID_INPUT_MSG,
    PARSE_INFO_MSG,
    crawlError,
    crawlResult,
    form,
    input,
    loader,
} from './utils/constants.js';

import {
    appendCommit,
    appendRelease,
    clearChilden,
    getFullCommits,
    getFullReleases,
    isValidGitRepo,
    showErr,
} from './utils/helpers.js';

// https://api.github.com/repos/charmbracelet/vhs/releases
// https://api.github.com/repos/charmbracelet/vhs/commits
// https://github.com/charmbracelet/vhs

// https://github.com/mastodon/mastodon
// https://api.github.com/repos/mastodon/mastodon
// https://api.github.com/repos/mastodon/mastodon/releases?per_page=100&page=1
// https://api.github.com/repos/mastodon/mastodon/tags?per_page=100&page=1
// api tags cho ít thông tin hơn releases
// https://api.github.com/repos/mastodon/mastodon/compare/{base}...{head}
// https://api.github.com/repos/mastodon/mastodon/commits

form.addEventListener('submit', async event => {
    // clear
    event.preventDefault();
    clearChilden(crawlResult);
    clearChilden(crawlError);
    startLoading(loader);

    // Get source and clear input
    const source = input.value.trim();
    input.value = '';
    input.focus();

    // Check source and start
    if (isValidGitRepo(source)) {
        // Get full release
        const releases = await getFullReleases(source);

        // Check số bản release lấy được và add vào crawl result
        console.log('Tổng số bản release lấy được: ' + releases.length);
        const totalReleases = document.createElement('div');
        totalReleases.classList.add('rel-total');
        totalReleases.innerHTML = `
            <span>Tổng số phiên bản: ${releases.length}</span>
        `;
        crawlResult.appendChild(totalReleases);

        // Khởi tạo result-list
        const resultList = document.createElement('ul');
        resultList.classList.add('result-list');

        try {
            // Note: release theo thứ tự từ mới đến cũ, commit giữa 2 release theo thứ tự từ bản release cũ đến bản release mới

            for (let num = 0; num < releases.length; num++) {
                const curRelease = releases[num];
                console.log(`Đang lấy thông tin của release ${curRelease.tag_name}`);

                // Lấy thông tin của release và chèn vào result list
                appendRelease(resultList, curRelease);

                // Lấy thông tin về diff commits so với bản release trước
                if (num < releases.length - 1) {
                    // Get full compare commits between 2 releases
                    const prevRelease = releases[num + 1];
                    // Lấy được full commits, api và html của compare page 1
                    const { fullCommits, comApi, comHtml } = await getFullCommits(
                        source,
                        prevRelease,
                        curRelease
                    );

                    // Chèn commit vào DOM
                    appendCommit(resultList, fullCommits, prevRelease, curRelease, comApi, comHtml);
                }
            }
            // Chèn kết quả cuối cùng vào DOM
            clearChilden(loader);
            crawlResult.appendChild(resultList);
        } catch (err) {
            if (err.message === PARSE_INFO_MSG || err.message === FETCH_ERR_MSG) {
                throw err;
            }
            showErr('', PARSE_INFO_MSG);
            clearChilden(loader);
            throw new Error(PARSE_INFO_MSG);
        }
    } else {
        // Không phải link github repo
        showErr(source, INVALID_INPUT_MSG);
        clearChilden(loader);
    }
});

// For loading animation
function startLoading(loaderElement) {
    loaderElement.innerHTML = `
        <div style="--delay: 1s"></div>
        <div style="--delay: 2s"></div>
        <div style="--delay: 3s"></div>
        <div style="--delay: 4s"></div>
        <div style="--delay: 5s"></div>
    `;
}
