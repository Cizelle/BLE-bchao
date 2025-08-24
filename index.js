

import 'react-native-get-random-values'; // Needed for some UUID generation logic
import { Buffer } from 'buffer';
global.Buffer = Buffer;

/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
