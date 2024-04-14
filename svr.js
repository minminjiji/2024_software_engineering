const express = require('express')
const mysql = require('mysql') // npm install mysql
const path = require('path') // 경로를 쉽게 만들기 위한 패키지 (경로때매 사용)
const static = require('serve-static') // 윗 조상을 설정해줌(경로때매 사용)
const dbconfig = require('./config/dbconfig.json')
const app = express()

// 노드js와 sql의 데이터 이동을 도와주는 배와 같은 역할
// database connection pool
const pool = mysql.createPool({
    connectionLimit: 10,
    host: dbconfig.host,
    user: dbconfig.user,
    password: dbconfig.password,
    database: dbconfig.database,
    debug: false
})

app.use(express.urlencoded({extended:true}))

app.use(express.json())
app.use('/public', static(path.join(__dirname,'public')))

app.post('/login', (req,res)=>{
    console.log('/login 호출됨 '+req)

    const paramId = req.body.id;//21,22라인과 연관 게 발린다
    const paramPassword = req.body.password;


    console.log('로그인 요청 '+paramId+' '+paramPassword);

    pool.getConnection((err,conn)=>{
        if(err){
            console.log(err)
            conn.release();
            console.log("Mysql getConnection error. aborted");
            res.writeHead('200',{'Content-Type':'text/html; charset=utf8'})
            res.write('<h1>DB서버연결 실패</h1>')
            res.end();
            return;
        }

        console.log('데이터베이스 연결')

        const exec = conn.query('select `ID`, `USERNAME` from `users` where `ID`=? and `PASSWORD`= ?',
                    [paramId,paramPassword],
                    (err, rows)=>{
                        conn.release();
                        console.log('실행된 SQL: '+exec.sql)

                        if(err){
                            console.dir(err);
                            res.writeHead('200',{'Content-Type':'text/html; charset=utf8'})
                            res.write('<h1>SQL query 실행 실패</h1>')
                            res.end();
                            return
                        }
                        if(rows.length > 0){
                            console.log('아이디 [%s], 패스워드가 일치하는 사용자 [%s] 찾음',paramId,rows[0].name)
                            res.writeHead('200',{'Content-Type':'text/html; charset=utf8'})
                            res.write('<h2>로그인 성공</h2>')
                            res.end();
                            return
                        }
                        else{
                            console.log('Inserted 실패')
                            res.writeHead('200',{'Content-Type':'text/html; charset=utf8'})
                            res.write('<h1>로그인 실패. 아이디와 패스워드를 확인하세요.</h1>')
                            res.end();
                            return  
                        }

                    }

        )
    })

});

app.post('/adduser', (req,res)=>{
    console.log('/adduser 호출됨 '+req)

    const paramId = req.body.id;//21,22라인과 연관 게 발린다
    const paramName = req.body.name;
    const paramPassword = req.body.password;
    const paramPasswordConfirm = req.body.passwordConfirm;
    const paramEmail = req.body.email;
    


    pool.getConnection((err, conn)=> {

        if(err){
            console.log(err)
            conn.release();
            console.log("Mysql getConnection error. aborted");
            res.writeHead('200',{'Content-Type':'text/html; charset=utf8'})
            res.write('<h1>DB서버연결 실패</h1>')
            res.end();
            return;
        }

        console.log('데이터베이스 연결');

        const exec = conn.query('insert into users (ID, USERNAME, PASSWORD, EMAIL) values (?,?,?,?);',
                [paramId,paramName,paramPassword,paramEmail],
                (err, result)=>{
                    conn.release();
                    console.log('실행된 SQL: '+exec.sql)

                    if(err){
                        console.log('SQL 실행시 오류 발생')
                        console.dir(err);
                        res.writeHead('200',{'Content-Type':'text/html; charset=utf8'})
                        res.write('<h1>SQL query 실행 실패</h1>')
                        res.end();
                        return
                    }

                    if(result){
                        console.dir(result)
                        console.log('Inserted 성공')
                        res.writeHead('200',{'Content-Type':'text/html; charset=utf8'})
                        res.write('<h2>사용자 추가 성공</h2>')
                        res.end();
                    }
                    else{
                        console.log('Inserted 실패')
                        res.writeHead('200',{'Content-Type':'text/html; charset=utf8'})
                        res.write('<h1>사용자 추가 실패</h1>')
                        res.end();
                        return
                    }

                }
        )
        
        

    })
})

app.listen(3000,()=>{
    console.log('Listening on port 3000');
})