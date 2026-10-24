export const optimizefunction = (url) => {
    const optimizeURL = url.replace("/upload/", "/upload/f_auto,q_auto,c_fill,g_auto,w_800,h_800/");
    return optimizeURL;
};
export const optimizeCategory = (url) => {
    const optimizeURL = url.replace("/upload/", "/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_400/");
    return optimizeURL;
};
