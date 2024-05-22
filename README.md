2024 1학기 소프트웨어공학 발자국팀
팀장 이민지
팀원 소재헌, 강민경, 최보람


travel.sql 적용법

MySQL Workbench 실행 및 데이터베이스 연결:
MySQL Workbench를 실행하고 대상 MySQL 서버에 연결합니다.

데이터베이스 선택:
좌측 사이드바에서 대상 데이터베이스를 선택 -> Open a SQL Script file in a new query tab -> tarvel.sql 선택 (저는 근데 스키마를 일단 새로 만들고 적용해봐서 안되면 데이터베이스 모양 눌러서 스키마 먼저 만들고 적용해보세요.)

파일 메뉴에서 SQL 파일 실행:
상단 메뉴에서 File > Open SQL Script를 선택하여 덤프한 SQL 파일을 엽니다. 파일이 편집기에 로드되면, 실행 버튼(번개 모양 아이콘)을 클릭하여 SQL 명령어들을 실행합니다.
스키마 우측 버튼 누르고 REFRESH ALL 하면 뜹니다!

스키마 테이블 구조는 노션에 업로드 해놨습니다!

2024.05.22 travle.zip
다운 받으시면 sql 파일과 소스파일 다 들어있어요
파일 경로는 다음과 같게 설정하시고 작동해보세요 
nodejs 서버 먼저 실행하시고 [loca](http://localhost:3000/) 접속.
       - app.js
       - uploads
       - public 폴더 내에 css, images, js, svg 포함되어 있어야 함
       - views
       
