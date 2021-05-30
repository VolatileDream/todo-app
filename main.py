import json
import sqlite3

from contextlib import closing
from flask import Flask, abort, render_template, request, redirect

app = Flask(__name__)
app.config.from_pyfile("config.py")
# this really isn't the right way to do this...
storage = lambda: sqlite3.connect(app.config['DB_FILE'])

def cursor(s):
  return closing(s.cursor())


@app.route('/')
def index():
  return render_template('index.html')


def as_int(val):
  if val is None:
    return None
  return int(val)


def str_id(id):
  if id is None:
    return None
  return str(id)


@app.route('/api/list')
def list_todos():
  with storage() as s:
    with cursor(s) as c:
      first_id = None
      last_id = None

      items = []

      c.execute("SELECT rowid, content, done, prev, next FROM Items;")
      for row in c:
        rowid, content, done, prev, next = row
        if next is None:
          last_id = rowid
        if prev is None:
          first_id = rowid

        items.append({
          "id": str_id(rowid),
          "content": content,
          "done": bool(done),
          "prev": str_id(prev),
          "next": str_id(next),
        })

      return {"todos":items, "first": str_id(first_id), "last": str_id(last_id)}
      

@app.route('/api/add', methods=['POST'])
def create_todo():
  print(request)
  print(request.get_json())
  content = request.get_json()["content"]

  with storage() as s:
    with cursor(s) as c:
      last_id = None
      c.execute("SELECT rowid FROM Items INDEXED BY Items_next WHERE next IS NULL;")
      row = c.fetchone()
      if row is not None:
        last_id = row[0]
    
      c.execute("INSERT INTO Items (content, prev) VALUES (?, ?);", (content, last_id))
      new_id = c.lastrowid
      if last_id is not None:
        c.execute("UPDATE Items SET next = ? WHERE rowid = ?;", (new_id, last_id))

      return {
        "id": str_id(new_id),
        "content": content,
        "done": False,
        "prev": str_id(last_id),
        "next": str_id(None),
      }


def row_or_404(c):
  "Fetch a row from the cursor, or raise 404."
  row = c.fetchone()
  if row is None:
    abort(404)
  return row
  

def list_remove_item(id, s):
  """Stitches the linked list to remove the item, but does not update the items row."""
  with cursor(s) as c:
    c.execute("SELECT prev, next FROM Items WHERE rowid = ?;", (id,))
    row = row_or_404(c)

    prev, next = row

    c.execute("UPDATE Items SET prev = ?, next = ? WHERE rowid = ?;", (None, None, id))

    if prev is not None:
      c.execute("UPDATE Items SET next = ? WHERE rowid = ?;", (next, prev))
    if next is not None:
      c.execute("UPDATE Items SET prev = ? WHERE rowid = ?;", (prev, next))


def list_insert_item(id, prev, next, s):
  """Inserts the provided id in between prev and next.

  Requires prev and next to be adjacent, and does not update id's row.
  """
  with cursor(s) as c:
    # Sanity check
    if prev is not None:
      c.execute("SELECT next FROM Items WHERE rowid = ?;", (prev,))
      prev_row = row_or_404(c)
      if prev_row[0] != next:
        abort(400, "Non adjacent insertion!")

    if next is not None:
      c.execute("SELECT prev FROM Items WHERE rowid = ?;", (next,))
      next_row = row_or_404(c)
      if next_row[0] != prev:
        abort(400, "Non adjacent insertion!")

    if prev is not None:
      c.execute("UPDATE Items SET next = ? WHERE rowid = ?;", (id, prev))
    if next is not None:
      c.execute("UPDATE Items SET prev = ? WHERE rowid = ?;", (id, next))

    c.execute("UPDATE Items SET prev = ?, next = ? WHERE rowid = ?;", (prev, next, id))

@app.route('/api/update/<id>', methods=['POST'])
def update_todo(id):
  id = int(id)

  r = request.get_json()

  with storage() as s:
    with cursor(s) as c:
      c.execute("SELECT content, done, prev, next FROM Items WHERE rowid = ?;", (id,))
      row = row_or_404(c)

      content, done, prev, next = row

      # Patch the request
      content = r.get("content", content)
      done = bool(r.get("done", done))
      # Need to detect if these change.
      new_prev = as_int(r.get("prev", prev))
      new_next = as_int(r.get("next", next))

      c.execute("UPDATE Items SET content = ?, done = ? WHERE rowid = ?;", (content, done, id))

      if new_prev != prev or new_next != next:
        # the item was moved!
        list_remove_item(id, s)
        list_insert_item(id, new_prev, new_next, s)

      return {
        "id": str_id(id),
        "content": content,
        "done": bool(done),
        "prev": str_id(new_prev),
        "next": str_id(new_next),
      }


@app.route('/api/delete/<id>', methods=['POST'])
def delete_todo(id):
  id = int(id)
  with storage() as s:
    list_remove_item(id, s)
    s.execute("DELETE FROM Items WHERE rowid = ?;", (id,))

  return {}


def setup():
  with storage() as s:
    # Items track their order using a doubly linked list, holding the id
    # of the item before and after them (or null).
    s.execute("""CREATE TABLE IF NOT EXISTS Items (
                    rowid INTEGER PRIMARY KEY,
                    content TEXT,
                    done BOOLEAN NOT NULL DEFAULT(FALSE),
                    prev INTEGER DEFAULT (NULL),
                    next INTEGER DEFAULT (NULL)
                  );""")
    # These would be unique, but that constraint is briefly violated during update.
    s.execute("""CREATE INDEX IF NOT EXISTS Items_next ON Items(next);""")
    s.execute("""CREATE INDEX IF NOT EXISTS Items_prev ON Items(prev);""")

setup()
