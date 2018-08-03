import { Observable } from 'rxjs';
import 'rxjs/add/operator/mergeMap';

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

  const postMessage = (imId, userId, { header, messages }) =>
    api.postJson('/chat.postEphemeral', {
      channel: imId, text: header, attachments: [{ text: messages.join('\n') }], as_user: false, user: userId,
    }).toPromise();

  return {
    getUserEmailForId, postResponse, postMessage,
  };
};
