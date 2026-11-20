import {readConfig} from './lib/config.mjs';

try {
  const {format, duration} = readConfig(process.env, {requireApiKey: false});
  console.log(`Formulario válido: formato=${format}, duración=${duration}s.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
