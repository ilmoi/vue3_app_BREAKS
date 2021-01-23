import createAuth0Client from '@auth0/auth0-spa-js'
import {computed, reactive, watchEffect} from 'vue'

// -----------------------------------------------------------------------------
// define data + methods

let client

const state = reactive({
  loading: true,
  isAuthenticated: false,
  user: {},
  popupOpen: false,
  error: null,
})

/** Authenticates the user using a popup window */
async function loginWithPopup() {
  state.popupOpen = true

  try {
    await client.loginWithPopup(0)
  } catch (e) {
    console.error(e)
  } finally {
    state.popupOpen = false
  }

  state.user = await client.getUser()
  state.isAuthenticated = true
}

/** Handles the callback when logging in using a redirect */
async function handleRedirectCallback() {
  state.loading = true

  try {
    await client.handleRedirectCallback()
    state.user = await client.getUser()
    state.isAuthenticated = true
  } catch (e) {
    state.error = e
  } finally {
    state.loading = false
  }
}

/** Authenticates the user using the redirect method */
function loginWithRedirect(o) {
  return client.loginWithRedirect(o)
}

/** Returns all the claims present in the ID token */
function getIdTokenClaims(o) {
  return client.getIdTokenClaims(o)
}

/** Returns the access token. If the token is invalid or missing, a new one is retrieved */
function getTokenSilently(o) {
  return client.getTokenSilently(o)
}

/** Gets the access token using a popup window */
function getTokenWithPopup(o) {
  return client.getTokenWithPopup(o)
}

/** Logs the user out and removes their session on the authorization server */
function logout(o) {
  return client.logout(o)
}

const authPlugin = {
  isAuthenticated: computed(() => state.isAuthenticated),
  loading: computed(() => state.loading),
  user: computed(() => state.user),
  getIdTokenClaims,
  getTokenSilently,
  getTokenWithPopup,
  handleRedirectCallback,
  loginWithRedirect,
  loginWithPopup,
  logout,
}

// -----------------------------------------------------------------------------
// security

//routing guard aka https://vuejs-course.com/courses/vuejs-3-complete-crash-course/router-guards
//there is currently no such equivalent for the composition api
export const routeGuard = (to, from, next) => {
  const {isAuthenticated, loading, loginWithRedirect} = authPlugin
  const verify = () => {
    // If the user is authenticated, continue with the route
    if (isAuthenticated.value) {
      return next()
    }
    // Otherwise, log in
    loginWithRedirect({appState: {targetUrl: to.fullPath}})
  }
  // If loading has already finished, check our auth state using `fn()`
  if (!loading.value) {
    return verify()
  }
  // Watch for the loading property to change before we check isAuthenticated
  watchEffect(() => {
    if (loading.value === false) {
      return verify()
    }
  })
}

// -----------------------------------------------------------------------------
// instantiate the SDK client

export const setupAuth = async (options, callbackRedirect) => {
  //NOTE: in vue quickstart this part was different -
  // 1) they used clientId/redirectUri in auth_config.json
  // 2) they converted it to client_id/redirect_uri here
  // we're just using client_id/redirect_uri directly inside the config file (why the complexity?)

  //"useRefreshTokens": true option enables rotating refresh tokens. This is best security practice
  //more - https://auth0.com/docs/tokens/refresh-tokens/refresh-token-rotation
  //and - https://auth0.com/docs/libraries/auth0-single-page-app-sdk

  client = await createAuth0Client(options)

  if (!callbackRedirect) callbackRedirect = () => {
    // here we're replacing the url in the browser (without reloading it) with
    //  1) the title of the current page
    //  2) the path of the current page
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  try {
    // If the user is returning to the app after authentication
    if (
      window.location.search.includes('code=') &&
      window.location.search.includes('state=')
    ) {
      // handle the redirect and retrieve tokens
      const {appState} = await client.handleRedirectCallback()
      // Notify subscribers that the redirect callback has happened, passing the appState
      // (useful for retrieving any pre-authentication state)
      callbackRedirect(appState)
    }
  } catch (e) {
    state.error = e
  } finally {
    // Initialize our internal authentication state
    state.isAuthenticated = await client.isAuthenticated()
    state.user = await client.getUser()
    state.loading = false
  }

  return {
    install: (app) => {
      app.config.globalProperties.$auth = authPlugin
      app.config.globalProperties.$lawl = () => {
        console.log('me is working')
      }
    },
  }
}