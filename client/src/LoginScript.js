const Login = async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const urlBase = 'http://67.205.172.88:5000';

  const doLogin = async () => {
    try {
      const response = await fetch(`${urlBase}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username, password: password }),
      });

      if (response.ok) {
        const jsonObject = await response.json();
        const user = JSON.stringify(jsonObject);

        if (user === "{\"msg\":[]}") {
          return "Failed to login";
        } else {
          // Login worked
          updateLastLoggedIn(username);
          
          localStorage.setItem('username', username);
          localStorage.setItem('password', password);

          console.log(JSON.stringify(jsonObject));
          return username;
        }
      }
    } catch (err) {
      return err;
    }
  };

  const updateLastLoggedIn = async (username) => {
    try {
      await fetch(`${urlBase}/api/updateLastLoggedIn`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username }),
      });
    } catch (err) {
      console.error(`Failed to update LastLoggedIn: ${err}`);
    }
  };

  return await doLogin();
}

export { Login };
