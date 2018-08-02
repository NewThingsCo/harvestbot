import { Observable } from 'rxjs';
import { empty } from 'rxjs/observable/empty';
import 'rxjs/add/operator/expand';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/reduce';

// import logger from './log';

export default (config, http, responseUrl) => {
  const api = http(
    'https://slack.com/api',
    {
      Authorization: `Bearer ${config.slackBotToken}`,
    },
  );

  const getUserEmailForId = userId =>
    api.getJson(`/users.info?user=${userId}&token=${config.slackBotToken}`)
      .mergeMap(({ user: { profile: { email } } }) => Observable.of(email))
      .toPromise();

  const postResponse = (header, messageArray) =>
    api.postJson(responseUrl, { text: header, attachments: messageArray ? [{ text: messageArray.join('\n') }] : [] }).toPromise();

  const getImsForPage = cursor =>
    api.getJson(`/im.list?token=${config.slackBotToken}&limit=100${cursor && `&cursor=${cursor}`}`)
      .map(({ response_metadata: { next_cursor: nextCursor }, ims }) => ({ nextCursor, ims }));

  const getImIds = userIds =>
    getImsForPage()
      .expand(({ nextCursor }) => (nextCursor ? getImsForPage(nextCursor) : empty()))
      .mergeMap(({ ims }) => ims)
      .map(({ user: userId, id: imId, is_user_deleted: deleted }) => ({ userId, imId, deleted }))
      .filter(({ userId, deleted }) => userIds.includes(userId) && !deleted)
      .reduce((result, item) => [...result, item], [])
      .toPromise();

  const postMessage = (imId, { header, messages }) =>
    api.postJson('/chat.postMessage', {
      channel: imId, text: header, attachments: [{ text: messages.join('\n') }], as_user: false,
    }).toPromise();

  return {
    getUserEmailForId, postResponse, getImIds, postMessage,
  };
};
