(ql:quickload "edn")
(defun read-and-save ()
  "Read a name, grade, location, date, and description from standard input and save them to an EDN file."
  (let* ((name (read-line :prompt "Enter name: "))
         (grade (read-line :prompt "Enter grade: "))
         (location (read-line :prompt "Enter location: "))
         (date (read-line :prompt "Enter date: "))
         (description (read-line :prompt "Enter description: "))
         (data `{:name ,name :grade ,grade :location ,location :date ,date :description ,description}))
    (with-open-file (out "data.edn" :direction :output :if-exists :supersede)
      (princ (cl:write-to-string data) out))))

(read-and-save)
