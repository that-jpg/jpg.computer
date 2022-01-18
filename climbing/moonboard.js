(function() {

    const data = [{
        name: "Cakewalk",
        set: "2016",
        benchmark: true,
        place: "Powerbloc",
        v_grade: "V4",
        font_grade: "6B+",
        date: "18/05/2021",
        instagram_link: "",
        google_drive_link: "https://drive.google.com/file/d/12BYd9jhwOnItoEyovm36-teiJUP1VzYk/view?usp=sharing",
        youtube_link: "https://www.youtube.com/watch?v=b_ms0jeQR6E"
    }, {
        name: "Cakewalk",
        set: "2016",
        benchmark: true,
        place: "Powerbloc",
        v_grade: "V4",
        font_grade: "6B+",
        date: "11/01/2022",
        instagram_link: "https://www.instagram.com/p/CY1XN0uJxXi/",
        google_drive_link: "https://drive.google.com/file/d/1cNPTo4qJms2MVePZ6fI1TP66Xj3Czpmu/view?usp=sharing",
        youtube_link: "https://www.youtube.com/watch?v=u_cEkykGf5A"
    }, {
        name: "Flash Gordon",
        set: "2016",
        benchmark: true,
        place: "Powerbloc",
        v_grade: "V4",
        font_grade: "6B+",
        date: "26/05/2021",
        instagram_link: "https://www.instagram.com/p/CY1aHPgpi2V/",
        google_drive_link: "https://drive.google.com/file/d/1TlJ1c-ek-0P_L1AGNWrDoJzwPn3w5JpP/view?usp=sharing",
        youtube_link: "https://www.youtube.com/watch?v=88J_5Q9RNno"
    }, {
        name: "Pull Yaself Up! Yay",
        set: "2016",
        benchmark: true,
        place: "Powerbloc",
        v_grade: "V4",
        font_grade: "6B+",
        date: "19/06/2021",
        instagram_link: "https://www.instagram.com/p/CY1eJRsJanH/",
        google_drive_link: "https://drive.google.com/file/d/1oUXIBaQ9V0kjNeAc80-1IHkNCKvTDG41/view?usp=sharing",
        youtube_link: "https://www.youtube.com/watch?v=WaBWJBoj_Ao"
    }];

    const columns = [{
        label: "Name",
        valueKey: 'name'
    }, {
        label: "Set",
        valueKey: 'set'
    }, {
        label: "Place",
        valueKey: "place"
    }, {
        label: "Grade",
        valueKey: ({ v_grade, font_grade }) => `${v_grade}/${font_grade}`
   }, {
        label: "Instagram",
        valueKey: ({ instagram_link }) => instagram_link ? `<a href='${instagram_link}'>Link</a>` : ''
    }, {
        label: "Google Drive",
        valueKey: ({ google_drive_link }) => google_drive_link ? `<a href='${google_drive_link}'>Link</a>` : ""
    }, {
        label: "Youtube",
        valueKey: ({ youtube_link }) => youtube_link ? `<a href='${youtube_link}'>Link</a>` : ""
    }, {
        label: "Date",
        valueKey: "date"
    }, {
        label: "Is Benchy?",
        valueKey: ({ benchmark }) => benchmark ? "Yes" : "No"
    }]

    const getValue = (row, valueKey) => {
        if (typeof valueKey === 'function') {
            return valueKey(row)
        }
        return row[valueKey]
    }

    const createTableHeader = (columns) => {

        const tr = document.createElement('tr');
        const ths = columns.map(({ label }) => {
            const th = document.createElement('th');
            th.innerHTML = label;
            return th;
        })
        tr.append(...ths)

        return tr;
    }

    const createTableBody = (columns, data) => {
        const tableBody = data.map((row) => {
            const tr = document.createElement('tr');
            const tds = columns.map(({ label, valueKey }) => {
                const td = document.createElement('td');
                td.innerHTML = getValue(row, valueKey);
                return td;
            })
            tr.append(...tds)
            return tr;
        })

        return tableBody;
    }

    const createTable = (columns, data) => {
        const table = document.createElement('table');
        const tableHeader = createTableHeader(columns);
        const tableBody = createTableBody(columns, data)

        table.append(tableHeader)
        table.append(...tableBody)
        return table;
    }


    const moonboardContainer = document.getElementById("moonboard_container")
    const table = createTable(columns, data);
    moonboardContainer.append(table)
    console.log('deub')
})();
