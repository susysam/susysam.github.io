<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <title>Miscellaneous | 3kh0</title>
    <style>
      .text-center {
        text-align: center;
      }
    </style>
  </head>
  <body style="background-color: #121212; color: #ffffff; font-family: 'Roboto', sans-serif; margin: 0; padding: 5%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
    <h2 style="text-align: center; font-size: 2em; margin-bottom: 1em;">Miscellaneous stuff</h2>
    <div style="width: 100%; max-width: 600px; margin-bottom: 2em;">
      <div>
        <h1>about:blank</h1>
        <div>
          <p>Enter a URL you want to be opened in a about:blank page below:</p>
          <p><input id="url-target" type="url" pattern="https://.*" placeholder="Enter a website URL" autocomplete="on" style="width: 100%; padding: 10px; border: none; border-radius: 10px; background-color: #2c2c2c; color: #ffffff;" /></p>
          <p>Note this will not work with some websites, but you can copy the link of this website and put it in for extra privacy.</p>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 1em;">
        <button id="create" style="padding: 10px 20px; border: none; border-radius: 10px; background-color: #b625cc; color: #ffffff;">Create page</button>
      </div>
    </div>
    <div style="width: 100%; max-width: 600px;">
      <div>
        <h1>Tab Cloaker</h1>
        <p>Enter a new tab title or a image URL below. What you set will be used on the whole site.</p>
        <p>
          <input id="userinput" type="url" placeholder="Enter a title or image URL" autocomplete="on" style="width: 100%; padding: 10px; border: none; border-radius: 10px; background-color: #2c2c2c; color: #ffffff;" />
        </p>
        <p id="console-output"></p>
      </div>
      <div class="button-wrapper" style="display: flex; justify-content: space-between; margin-top: 1em;">
        <button onclick="changeTabTitle();" style="padding: 10px 20px; border: none; border-radius: 10px; background-color: #b625cc; color: #ffffff;">Set Title</button>
        <button onclick="changeTabIcon();" style="padding: 10px 20px; border: none; border-radius: 10px; background-color: #b625cc; color: #ffffff;">Set Icon</button>
        <button onclick="resetTabSettings();" style="padding: 10px 20px; border: none; border-radius: 10px; background-color: #b625cc; color: #ffffff;">Reset</button>
      </div>
    </div>
    <p style="text-align: center; margin-top: 2em;">
      <a href="/index.html" style="text-decoration: none;">
        <button style="cursor: pointer; background-color: #22c55e; border: none; color: white; padding: 15px 32px; text-decoration: none; display: inline-block; font-size: 16px; border-radius: 20px; margin-top: 5px;">
          Go to the homepage
        </button>
      </a>
    </p>
    <script src="/js/misc.js"></script>
    <script src="/js/main.js"></script>
  </body>
</html>
