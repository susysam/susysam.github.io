<?php
// Initialize session
session_start();

// Check if the user is already logged in, redirect to welcome page if logged in
if(isset($_SESSION["username"])) {
    header("location: welcome.php");
    exit;
}

// Check if form is submitted for user registration
if($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST["signup"])) {
    // Include your database connection code here

    // Define your database connection credentials
    $servername = "localhost"; // Change this to your database server name
    $username = "root"; // Change this to your database username
    $password = ""; // Change this to your database password
    $dbname = "your_database"; // Change this to your database name

    // Create connection
    $conn = new mysqli($servername, $username, $password, $dbname);

    // Check connection
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    // Extract and sanitize input data from the registration form
    $username = mysqli_real_escape_string($conn, $_POST['username']);
    $password = password_hash($_POST['password'], PASSWORD_DEFAULT); // Hash the password

    // SQL query to insert user data into the database
    $sql = "INSERT INTO users (username, password) VALUES ('$username', '$password')";

    // Execute SQL query
    if ($conn->query($sql) === TRUE) {
        // Redirect to login page after successful registration
        header("location: login.php");
    } else {
        echo "Error: " . $sql . "<br>" . $conn->error;
    }

    // Close database connection
    $conn->close();
}

// Check if form is submitted for user login
if($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST["login"])) {
    // Include your database connection code here

    // Define your database connection credentials
    $servername = "localhost"; // Change this to your database server name
    $username = "root"; // Change this to your database username
    $password = ""; // Change this to your database password
    $dbname = "your_database"; // Change this to your database name

    // Create connection
    $conn = new mysqli($servername, $username, $password, $dbname);

    // Check connection
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    // Extract and sanitize input data from the login form
    $username = mysqli_real_escape_string($conn, $_POST['username']);
    $password = mysqli_real_escape_string($conn, $_POST['password']);

    // SQL query to retrieve user data from the database based on the provided username
    $sql = "SELECT * FROM users WHERE username='$username'";
    $result = $conn->query($sql);

    // Check if user exists in the database
    if ($result->num_rows > 0) {
        // User found, verify password
        $row = $result->fetch_assoc();
        if (password_verify($password, $row["password"])) {
            // Password is correct, start session and redirect to welcome page
            $_SESSION["username"] = $username;
            header("location: welcome.php");
        } else {
            // Incorrect password
            $login_err = "Invalid username or password.";
        }
    } else {
        // User not found
        $login_err = "Invalid username or password.";
    }

    // Close database connection
    $conn->close();
}
?>
