/** Keep local assets inside the deployment prefix, including nested glTF files. */
export function assetPath(url:string,basePath=process.env.NEXT_PUBLIC_BASE_PATH??''){
  const base=basePath.replace(/\/$/,'');
  if(!base||!url.startsWith('/')||url.startsWith('//')||url===base||url.startsWith(base+'/'))return url;
  return base+url;
}
