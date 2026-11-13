// GitHub Pages serves static files only. Keep old bookmarks usable without
// sending passwords to a static host or creating a second data workspace.
if(location.hostname==='phongtrl.github.io'){
  location.replace('https://kvadrat-trondheim-phong.fearlesswaterbuck8.chatgpt.site/'+location.hash);
}else{
  import('./app.js?v=login-response-v2');
}
