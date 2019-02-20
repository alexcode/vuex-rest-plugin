import Vue from 'vue';
import Vuex from 'vuex';
import axios from 'axios';
import { ApiStorePlugin, ApiState } from '../lib';

Vue.use(Vuex);
const axiosInstance = axios.create();
axiosInstance.defaults.transformResponse = [data => JSON.parse(data).json];

export default new Vuex.Store({
  plugins: [
    ApiStorePlugin({
      axios: axiosInstance,
      models: {
        resource: {
          name: 'RESOURCE',
          plural: 'RESOURCES',
          type: new ApiState(),
          references: {
            user: 'user',
            vehicle: 'vehicle'
          }
        },
        user: {
          name: 'USER',
          plural: 'USERS',
          type: new ApiState(),
          references: {
            role: 'role'
          }
        },
        vehicle: {
          name: 'VEHICLE',
          plural: 'VEHICLES',
          type: new ApiState()
        },
        role: {
          name: 'ROLE',
          plural: 'ROLES',
          type: new ApiState()
        }
      }
    })
  ]
});
