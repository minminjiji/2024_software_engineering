const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const session = require("express-session"); // 세션 관리용 미들웨어
const fileStore = require("session-file-store")(session);
const mysql = require("mysql");
const path = require("path");
const multer = require("multer");
const moment = require("moment");

const port = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Body-parser 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // JSON 데이터 처리를 위한 설정
// 정적 파일 제공을 위한 public 디렉토리 설정
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "views")));

// 데이터베이스 연결 설정
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1107",
    database: "travel",
});

connection.connect((err) => {
    if (err) {
        return console.error("Error connecting to MySQL: " + err.message);
    }
    console.log("Connected to the MySQL server.");
});

// 세션 설정 (메모리 스토어 사용)
app.use(
    session({
        secret: "secret key", // 암호화하는 데 쓰일 키
        resave: false, // 세션을 언제나 저장할지 설정함
        saveUninitialized: true, // 세션이 저장되기 전 uninitialized 상태로 미리 만들어 저장
        cookie: {
            // 세션 쿠키 설정 (세션 관리 시 클라이언트에 보내는 쿠키)
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: false,
            secure: false,
        },
    })
);

// 루트 경로로 접속했을 때 HTML 파일 제공 - 이 부분을 main.html로 변경
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "main.html"));
});

app.get("/retouch", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "retouch.html"));
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/"); // 파일이 저장될 서버의 경로
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname); // 파일 이름 설정
    },
});

const upload = multer({ storage: storage });

// 이미지 업로드 및 데이터베이스 저장 라우트
app.post(
    "/upload-profile",
    upload.single("profileImage"),
    function (req, res, next) {
        const filePath = "/uploads/" + req.file.filename; // 데이터베이스에 저장할 경로

        // 여기서 필요한 데이터베이스 작업을 수행하세요
        const sql = "INSERT INTO users (profileImagePath) VALUES (?)";
        connection.query(sql, [filePath], function (error, results, fields) {
            if (error) throw error;
            res.send("File uploaded and saved in database successfully");
        });
    }
);

// 회원가입 페이지 제공
app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "signup.html"));
});

//마이페이지 페이지 제공
app.get("/mypage", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "mypage.html"));
});

// 폼 데이터를 받아 MySQL 데이터베이스에 저장
app.post("/signup", (req, res) => {
    const data = {
        ID: req.body.id,
        USERNAME: req.body.username,
        PASSWORD: req.body.password,
        EMAIL: req.body.email,
    };

    // 먼저 ID가 이미 존재하는지 확인
    connection.query(
        "SELECT * FROM users WHERE ID = ?",
        [data.ID],
        (err, results) => {
            if (err) {
                return res
                    .status(500)
                    .send(
                        "사용자 ID를 확인하는 도중 오류 발생: " + err.message
                    );
            }
            if (results.length > 0) {
                return res
                    .status(400)
                    .send("이미 존재하는 ID입니다. 다른 ID를 선택해 주세요.");
            } else {
                // ID가 존재하지 않으면 새 사용자 삽입
                const sql =
                    "INSERT INTO users (ID, USERNAME, PASSWORD, EMAIL) VALUES (?, ?, ?, ?)";
                connection.query(
                    sql,
                    [data.ID, data.USERNAME, data.PASSWORD, data.EMAIL],
                    (error, results) => {
                        if (error) {
                            return res
                                .status(500)
                                .send(
                                    "회원가입 중 오류 발생: " + error.message
                                );
                        }
                        res.send("회원가입 완료!");
                    }
                );
            }
        }
    );
});

// 로그인 페이지 제공
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "login.html"));
});

// 로그인 처리
app.post("/login", (req, res) => {
    const { id, password } = req.body;

    if (id && password) {
        connection.query(
            "SELECT * FROM users WHERE ID = ? AND PASSWORD = ?",
            [id, password],
            (err, results) => {
                if (err) {
                    return res
                        .status(500)
                        .send("로그인 처리 중 오류 발생: " + err.message);
                }
                if (results.length > 0) {
                    req.session.is_logined = true; // 세션 정보 갱신
                    req.session.user_id = req.body.id;
                    req.session.username = results[0].USERNAME;
                    req.session.save(function () {
                        console.log(req.session);
                        res.redirect(`/`);
                        // res.send("로그인 성공!");
                    });
                } else {
                    res.send(`<script type="text/javascript">alert("로그인 정보가 일치하지 않습니다."); 
                    document.location.href="/login";</script>`);
                }
            }
        );
    } else {
        res.send(`<script type="text/javascript">alert("아이디와 비밀번호를 입력하세요!"); 
        document.location.href="/login";</script>`);
    }
});

//로그아웃 페이지 제공
app.get("/logout", (req, res) => {
    req.session.destroy(function (err) {
        res.redirect("/");
    });
});

//다이어리 페이지 제공
app.get("/diary", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "diary.html"));
});

//사진 업로드
app.post("/upload", (req, res) => {
    var today = new Date();
    console.log(req.body);
    const data = {
        user_id: req.session.user_id,
        title: req.body.title,
        content: req.body.content,
        photo_url: req.body.photo_url,
        created_at: moment(today).format("YYYY-MM-DD HH:mm:ss"),
    };
    console.log(data);
    const sql =
        "INSERT INTO diary (user_id, title, content, photo_url, created_at) VALUES (?, ?, ?, ?, ?)";
    connection.query(
        sql,
        [
            data.user_id,
            data.title,
            data.content,
            data.photo_url,
            data.created_at,
        ],
        (error, results) => {
            if (error) {
                return res
                    .status(500)
                    .send("업로드 중 오류 발생: " + error.message);
            }
            res.send("업로드 완료!");
        }
    );
});

app.get("/wishlist", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "wishlist.html"));
});

// 지역별 축제 데이터를 가져오는 라우트
app.get("/festival", (req, res) => {
    const region = req.query.region;

    const query = "SELECT * FROM festival WHERE CTPRVN_NM = ?";
    connection.query(query, [region], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(results);
    });
});

// 초기 10개의 여행지 목록을 제공하는 경로 설정
app.get("/tour", (req, res) => {
    const sql = "SELECT id, subject, image FROM course LIMIT 10";
    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching courses: " + err.message);
            return res.status(500).send("Error fetching courses");
        }
        res.render("tour", { courses: results });
    });
});

// AJAX 요청을 통해 추가 여행지 목록을 제공하는 경로 설정
app.get("/api/more-courses", (req, res) => {
    const offset = parseInt(req.query.offset) || 0;
    const sql = "SELECT id, subject, image FROM course LIMIT 10 OFFSET ?";
    connection.query(sql, [offset], (err, results) => {
        if (err) {
            console.error("Error fetching more courses: " + err.message);
            return res.status(500).send("Error fetching more courses");
        }
        res.json(results);
    });
});

// 특정 여행지의 상세 정보를 제공하는 경로 설정
app.get("/tour/:id", (req, res) => {
    const tourId = req.params.id;
    const sql = "SELECT * FROM course WHERE id = ?";
    connection.query(sql, [tourId], (err, results) => {
        if (err) {
            console.error("Error fetching tour details: " + err.message);
            return res.status(500).send("Error fetching tour details");
        }
        if (results.length === 0) {
            return res.status(404).send("Tour not found");
        }
        res.render("tour-details", { course: results[0] });
    });
});

// 서버 실행
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
