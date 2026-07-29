/**
 * TypeScript fallback. Metro uses `.native` / `.web` at bundle time instead.
 * Re-export the web implementation so IDE/tsc never pull in pager-view.
 */
export { SwipePage, SwipePager } from "./SwipePager.web";
