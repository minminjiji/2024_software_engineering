const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const session = require("express-session"); // 세션 관리용 미들웨어
const fileStore = require("session-file-store")(session);
const mysql = require("mysql");
const path = require("path");
const multer = require("multer");
const moment = require("moment");
const fs = require('fs');

const port = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());


// Body-parser 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // JSON 데이터 처리를 위한 설정
// 정적 파일 제공을 위한 public 디렉토리 설정
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "views")));

// 데이터베이스 연결 설정
const connection = mysql.createConnection({
    host: "203.234.62.118",
    user: "travel",
    password: "Qkfwkrnrxla123!",
    database: "travel",
    dataString: "date"
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
        store: new fileStore()
    })
);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/"); // 파일이 저장될 서버의 경로
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname); // 파일 이름 설정
    },
});

const upload = multer({ storage: storage });

// 루트 경로로 접속했을 때 HTML 파일 제공 - 이 부분을 main.html로 변경
app.get("/", (req, res) => {
    const sql = "SELECT user_id, diary_id, title, photo_url, content FROM diary LIMIT 10 ";
    connection.query(sql, [req.session.user_id], (err, results) => {
        if (err) {
            console.error("Error fetching courses: " + err.message);
            return res.status(500).send("Error fetching courses");
        }
        res.render("main", { session: req.session });
    });
});

app.post("/retouch/:id", upload.single("profileImage"), async (req, res) => {
    const { username, password, email } = req.body;
    console.log(req.file.filename)
    const image = "/uploads/" + req.file.filename;
    const { id } = req.params;


    console.log("나 실행되고 있어..?");

    try {
        // users 배열의 첫 번째 요소를 user로 설정
        await connection.query('SELECT * FROM users WHERE ID = ?', [id],(error,results)=>{
            console.log(results.ID)
            if(error){
                console.log(error);
            }
            if (results.length === 0) {
                return res.alert("유저를 찾을 수 없습니다.");
            }

            if (req.file) {
                //기존 이미지를 파일 경로
                const existingImagePath = results.image;
                //기존 이미지가 있으면 삭제
                if (existingImagePath) {
                    fs.unlinkSync(existingImagePath);
                }
            }
        });
        
        

        const updateQuery = `
            UPDATE users
            SET image = ?, USERNAME = ?, PASSWORD = ?, EMAIL = ?
            WHERE ID = ?
        `;
        // console.log(image, username, password, email, id);
        const updateValues = [image, username, password, email, id];

        // 업데이트 쿼리 실행
        await connection.query(updateQuery, updateValues);

        req.session.username = username;
        req.session.userimage = image;

        //diary-list 이동
        req.session.save((err) => {
            if (err) {
                console.error("Error saving session: " + err.message);
                return res.status(500).send("Error saving session");
            }
            //diary-list 이동
            res.redirect("/diary-list");
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Something went wrong' });
    }
});

//유저정보 수정
app.get("/retouch/:id", (req, res) => {
    res.render("retouch", { session: req.session });
});



// 이미지 업로드 및 데이터베이스 저장 라우트
app.post(
    "/upload-profile",
    upload.single("profileImage"),
    function (req, res, next) {
        const filePath = "/uploads/" + req.file.filename; // 데이터베이스에 저장할 경로

        // 여기서 필요한 데이터베이스 작업을 수행하세요
        const sql = "UPDATE INTO users (profileImagePath) VALUES (?)";
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
    res.render("mypage", { session: req.session });
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
                    req.session.userimage = results[0].image;
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
    res.render("diary",{session:req.session});
});

//사진 업로드
app.post("/upload-diary", upload.single("photo"), (req, res) => {
    var today = new Date();
    const data = {
        user_id: req.session.user_id,
        title: req.body.title,
        content: req.body.content,
        photo_url: "/uploads/" + req.file.filename,
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
            res.redirect('/diary-list');
        }
    );
});

app.get("/wishlist", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "wishlist.html"));
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

// 게시판 형태의 여행 정보 페이지 제공
app.get("/course", (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let offset = (page - 1) * 10;

    const sql =
        'SELECT num, POI_NM, CL_NM, CONCAT(CTPRVN_NM, " ", SIGNGU_NM) AS 지역 FROM tour LIMIT 10 OFFSET ?';
    connection.query(sql, [offset], (err, results) => {
        if (err) {
            console.error("Error fetching tour data: " + err.message);
            return res.status(500).send("Error fetching tour data");
        }

        // 전체 레코드 수를 가져와서 페이지 계산에 사용
        connection.query(
            "SELECT COUNT(*) AS count FROM tour",
            (countErr, countResults) => {
                if (countErr) {
                    console.error(
                        "Error fetching tour count: " + countErr.message
                    );
                    return res.status(500).send("Error fetching tour count");
                }

                let totalRecords = countResults[0].count;
                let totalPages = Math.ceil(totalRecords / 10);

                res.render("course", {
                    tours: results,
                    currentPage: page,
                    totalPages: totalPages,
                });
            }
        );
    });
});

// 특정 게시물의 세부 정보를 가져오는 라우트
app.get("/course/:num", (req, res) => {
    const tourNum = req.params.num;
    const sql = "SELECT * FROM tour WHERE num = ?";
    connection.query(sql, [tourNum], (err, result) => {
        if (err) {
            console.error("Error fetching tour details: " + err.message);
            return res.status(500).send("Error fetching tour details");
        }
        if (result.length === 0) {
            return res.status(404).send("Tour not found");
        }
        res.render("course-details", { tour: result[0] });
    });
});

// 축제 정보 게시판 제공
app.get("/festival", (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let offset = (page - 1) * 10;

    const sql =
        'SELECT ID, FCLTY_NM, CONCAT(CTPRVN_NM, " ", SIGNGU_NM) AS 지역, OPMTN_PLACE_NM, FSTVL_BEGIN_DE, FSTVL_END_DE FROM festival LIMIT 10 OFFSET ?';
    connection.query(sql, [offset], (err, results) => {
        if (err) {
            console.error("Error fetching festival data: " + err.message);
            return res.status(500).send("Error fetching festival data");
        }

        // 전체 레코드 수를 가져와서 페이지 계산에 사용
        connection.query(
            "SELECT COUNT(*) AS count FROM festival",
            (countErr, countResults) => {
                if (countErr) {
                    console.error(
                        "Error fetching festival count: " + countErr.message
                    );
                    return res
                        .status(500)
                        .send("Error fetching festival count");
                }

                let totalRecords = countResults[0].count;
                let totalPages = Math.ceil(totalRecords / 10);

                res.render("festival", {
                    festivals: results,
                    currentPage: page,
                    totalPages: totalPages,
                });
            }
        );
    });
});

// 특정 축제의 세부 정보를 가져오는 라우트
app.get("/festival/:id", (req, res) => {
    const festivalId = req.params.id;
    const sql = "SELECT * FROM festival WHERE ID = ?";
    connection.query(sql, [festivalId], (err, result) => {
        if (err) {
            console.error("Error fetching festival details: " + err.message);
            return res.status(500).send("Error fetching festival details");
        }
        if (result.length === 0) {
            return res.status(404).send("Festival not found");
        }
        res.render("festival-details", { festival: result[0] });
    });
});

app.get("/diary-list", (req, res) => {
    const sql = "SELECT diary_id, title, photo_url FROM diary where user_id =?";
    connection.query(sql, [req.session.user_id], (err, results) => {
        if (err) {
            console.error("Error fetching courses: " + err.message);
            return res.status(500).send("Error fetching courses");
        }
        res.render("diary-list", { list: results, session: req.session });
    });
});


app.get("/:id", (req, res) => {
    const diaryId = req.params.id;
    const sql = "SELECT * FROM diary WHERE diary_id = ?";
    connection.query(sql, [diaryId], (err, results) => {
        if (err) {
            console.error("Error fetching tour details: " + err.message);
            return res.status(500).send("Error fetching tour details");
        }
        if (results.length === 0) {
            return res.status(404).send("diary_detail not found");
        }
        res.render("diary-details", { list: results[0] });
    });
});

// 서버 실행
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
