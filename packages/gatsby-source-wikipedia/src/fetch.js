const Promise = require(`bluebird`)
const queryString = require(`query-string`)
const fetch = require(`node-fetch`)

const apiBase = lang => `https://${lang}.wikipedia.org/w/api.php?`

const fetchNodesFromSearch = ({ query, limit = 15, lang = 'en' }) =>
  search({ query, limit }).then(results =>
    Promise.map(results, async (result, queryIndex) => {
      const rendered = await getArticle(result.id, lang)
      const metadata = await getMetaData(result.id, lang)
      return {
        id: result.id,
        title: result.title,
        description: result.description,
        updatedAt: metadata.updated,
        queryIndex: queryIndex + 1,
        rendered,
      }
    })
  )

const getMetaData = (name, lang = 'en') =>
  fetch(
    `${apiBase(lang)}${queryString.stringify({
      action: `query`,
      titles: name,
      format: `json`,
      redirects: `resolve`,
      prop: `extracts|revisions`,
      explaintext: 1,
      exsentences: 1,
    })}`
  )
    .then(response => response.json())
    .then(data => {
      var page = data.query.pages[Object.keys(data.query.pages)[0]]

      if (`missing` in page) {
        return { err: `Not found` }
      }

      let updated = new Date().toJSON()
      if (page.revisions) {
        updated = page.revisions[0].timestamp
      } else {
        console.log({ page, revisions: page.revisions })
      }
      return {
        title: page.title,
        extract: page.extract,
        urlId: page.title.replace(/\s/g, `_`),
        updated,
      }
    })

const search = ({ query, limit, lang = 'en' }) =>
  fetch(
    `${apiBase(lang)}${queryString.stringify({
      action: `opensearch`,
      search: query,
      format: `json`,
      redirects: `resolve`,
      limit,
    })}`
  )
    .then(response => response.json())
    .then(([term, pageTitles, descriptions, urls]) =>
      pageTitles.map((title, i) => {
        return {
          title,
          description: descriptions[i],
          id: /en.wikipedia.org\/wiki\/(.+)$/.exec(urls[i])[1],
        }
      })
    )

/**
 * You can get wikipedia articles in different languages
 */
const getArticle = (name, lang = 'en') =>
  fetch(`https://${lang}.m.wikipedia.org/wiki/${name}?action=render`)
    .then(res => res.text())
    .then(pageContent =>
      pageContent.replace(/\/\/en\.wikipedia\.org\/wiki\//g, `/wiki/`)
    )

module.exports = { fetchNodesFromSearch, getMetaData, getArticle, search }
