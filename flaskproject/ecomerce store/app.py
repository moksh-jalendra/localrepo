from flask import Flask , render_template , request , redirect , url_for 

from product import products

app = Flask(__name__)


users = {'admin@gmail.com':"1234"}

@app.route("/")

def home():
    return render_template('index.html', products=products)

@app.route("/login" , methods = ['GET','POST'])

def login():
    if request.method == 'POST' :
        username = request.form.get('email')
        password = request.form.get("password")

        if username in users and users[username] == password :
            return redirect(url_for("home"))
        else :
            return render_template('login.html')
    return render_template('login.html')

if __name__ == '__main__' :
    app.run( debug = True)