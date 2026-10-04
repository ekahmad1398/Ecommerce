export const optimizefunction = (url) => {
  const optimizeURL = url.replace(
    "/upload/",
    "/upload/f_auto,q_auto,c_fill,g_auto,w_800,h_800/",
  );
  return optimizeURL
};
