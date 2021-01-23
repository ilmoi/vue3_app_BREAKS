import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// createApp(App).use(router).mount('#app')

const app = createApp(App)

//router
app.use(router)


//auth0
import {setupAuth} from "./auth/index";
import authConfig from "../auth_config.json";

function callbackRedirect(appState) {
  router.push(
    appState && appState.targetUrl
      ? appState.targetUrl
      : '/'
  );
}

//mount needs to happen inside of "then", so auth0 must go last
setupAuth(authConfig, callbackRedirect)
  .then(auth => app.use(auth).mount('#app'))

