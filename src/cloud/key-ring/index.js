import { google } from 'googleapis';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';

import log from '../../log';
import storage from '../storage';

export default (config) => {
  const { projectId, region } = config;
  const logger = log(config);
  const fileName = 'harvestbot-config.encrypted';
  const localFilePath = `${tmpdir()}/${fileName}`;
  const secretStorage = storage(config);
  const keyName = `projects/${projectId}/locations/${region}/keyRings/${projectId}-keyring/cryptoKeys/${projectId}-encryption-key`;

  const authorise = async () => {
    const authClient = await google.auth.getClient({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    if (authClient) {
      return google.cloudkms({
        version: 'v1',
        auth: authClient,
      });
    }
    logger.error('Unable to create cloudkms service.');
    return null;
  };

  const encryptSecret = async (plainText) => {
    logger.info('Authorizing to Google Cloud');
    const cloudkms = await authorise();

    if (cloudkms) {
      logger.info('Authorize done, encrypting and storing configuration.');
      const request = {
        name: keyName,
        resource: {
          plaintext: Buffer.from(plainText).toString('base64'),
        },
      };
      try {
        const response = await cloudkms.projects.locations.keyRings.cryptoKeys.encrypt(request);
        if (response) {
          writeFileSync(localFilePath, Buffer.from(response.data.ciphertext, 'base64'));
          logger.info(`Written encrypted config to file: ${localFilePath}`);
          await secretStorage.uploadSecret(localFilePath);
          logger.info('Uploaded encrypted file to storage.');
          return localFilePath;
        }
      } catch (error) {
        logger.error(`Error in file encryption: ${error}`);
      }
    }
    return null;
  };

  const decryptSecret = async () => {
    const cloudkms = await authorise();
    if (cloudkms) {
      await secretStorage.downloadSecret(fileName, localFilePath);
      const fileContent = readFileSync(localFilePath);
      unlinkSync(localFilePath);
      const request = {
        name: keyName,
        resource: {
          ciphertext: Buffer.from(fileContent).toString('base64'),
        },
      };
      try {
        const response = await cloudkms.projects.locations.keyRings.cryptoKeys.decrypt(request);
        return Buffer.from(response.data.plaintext, 'base64');
      } catch (error) {
        logger.error(`Error in file decryption: ${error}`);
      }
    }
    return null;
  };

  return {
    encryptSecret,
    decryptSecret,
  };
};
