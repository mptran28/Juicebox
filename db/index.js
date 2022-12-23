const { Client } = require('pg');
const client = new Client('postgres:localhost:5432/juicebox-dev');

async function createUser({ 
    username, 
    password, 
    name, 
    location 
}) {
  try {
    const { rows: [user] } = await client.query(`
      INSERT INTO users(username, password, name, location) 
      VALUES($1, $2, $3, $4) 
      ON CONFLICT (username) DO NOTHING 
      RETURNING *;
    `, [username, password, name, location]);

    return user;
  } catch (error) {
    throw error;
  }
}


async function getAllUsers(){
  try{ 
    const { rows } = await client.query(
    `SELECT *
    FROM users;`
    );
    return rows;
  } catch(error) {
    throw error
  }
  }
  
  
  async function updateUser(id, fields = {}) {
    // build the set string
    const setString = Object.keys(fields).map(
      (key, index) => `"${ key }"=$${ index + 1 }`
      ).join(', ');
      
      // return early if this is called without fields
      if (setString.length === 0) {
        return;
      }
      
      try {
        const { rows: [user]} = await client.query(`
        UPDATE users
        SET ${ setString }
        WHERE id=${ id }
        RETURNING *;
        `, Object.values(fields));
        
        return user;
      } catch (error) {
        throw error;
      }
    }
    
    async function getUserById(userId) {
      try {
        console.log("Before row user")
        const { rows: [user] } = await client.query(`
        SELECT * FROM users
        WHERE id=${ userId };`)
        console.log("after row user: ", user)

        if(!user) {
          return null
        }
        console.log("before getPostsByUser")
        user.post = await getPostsByUser(userId);
        console.log("after getPostsByUser")
        return user;
      } catch (error) {
        throw error
      }
    }

    async function createPost({
      authorId, 
      title,
      content,
      tags = []
    }) {
      try {
        const { rows: [ post ] }= await client.query(`
          INSERT INTO posts("authorId", title, content)
          VALUES($1, $2, $3)
          RETURNING *;
        `,[authorId, title, content]);
        
        console.log("im here in createPost creatingTags in index")

        const tagList = await createTags(tags);

        console.log("after creating tags in index")
        return await addTagsToPost(post.id, tagList);
      } catch (error) {
        throw error
      }
    } 
    
    async function updatePost(postId, fields = { }) {
      console.log("Beginning of updatePost in index")
      const { tags } = fields;
      delete fields.tags;
      console.log("in UpdatePost calling fields: ", fields)
      const setString = Object.keys(fields).map(
        (key, index) => `"${ key }" =$${ index + 1}`
      ).join(', ');
      
      try{
        if (setString.length > 0) {
          await client.query(`
          UPDATE posts
          SET ${ setString }
          WHERE id=${ postId }
          RETURNING *
          `, Object.values(fields));
      }
      
      if (tags === undefined) {
        return await getPostById(postId);
      }

      const tagList = await createTags(tags);
      const tagListIdString = tagList.map(
        tag => `${ tag.id }`
      ).join(', ');

      await client.query(`
        DELETE FROM post_tags
        WHERE "tagId"
        NOT IN (${ tagListIdString })
        AND "postId"=$1;
        `, [postId]);

      await addTagsToPost(postId, tagList);
      
      return await getPostById(postId)
      
        } catch (error) {
          console.error("ERROR IN UPDATEPOST")
          throw error
    
        } 
        
      };
    
    async function getAllPosts() {
      try {
        console.log("beginning of getAllPost in index")
        const { rows : postIds } = await client.query(
          `SELECT id
          FROM posts`
        );

        const posts = await Promise.all(postIds.map(
          post => getPostById( post.id )
        ));

        console.log("help me in getAllPosts in index", posts)
        return posts;
      } catch (error) {
        throw error
      }
    }

    async function getPostsByUser(userId) {
      try {
        const { rows:  postIds  } = await client.query(`
        SELECT id
        FROM posts
        WHERE "authorId"=${ userId };
        `)

        const posts = await Promise.all(postIds.map(
          post => getPostById( post.id )
        ));

        return posts;
      } catch (error) {
        throw error;
      }
    }

    async function createTags(tagList){
      if (tagList.length === 0){
        return;
      }

      const insertValues = tagList.map((_, index) => `$${index + 1}`).join('), (');
      console.log(insertValues)
      const selectValues = tagList.map((_, index) => `$${index + 1}`).join(', ');
      console.log(selectValues)

      try {
        await client.query(`
        INSERT INTO tags(name) 
        VALUES (${insertValues})
        ON CONFLICT (name) DO NOTHING;
        `, tagList);
        
        const { rows: tags } = await client.query(`
          SELECT * FROM tags
          WHERE name
          IN (${selectValues});
        `, tagList);

        console.log("tags in index", tags)

        return tags;
      } catch (error) {
        console.error("ERROR IN CREATE TAG in index")
        throw error
      }
    }

    async function createPostTag(postId, tagId) {
      try {

        console.log("before in createPostTag")
        await client.query(`
        INSERT INTO post_tags("postId", "tagId")
        VALUES ($1, $2)
        ON CONFLICT ("postId", "tagId") DO NOTHING;
        `, [postId, tagId]);



      } catch (error) {
        console.error("error in CREATEPOSTTAG in index")
        throw error
      }
    }

    async function addTagsToPost(postId, tagList) {
      try {
        console.log("taglist", tagList)

        const createPostTagPromises = tagList.map((tag) => createPostTag(postId, tag.id));
        
        console.log("creating PostTagPromises in index")

        await Promise.all(createPostTagPromises);
    
        console.log("after creatingPostTagPromises in index")
        return await getPostById(postId);
      } catch (error) {
        throw error;
      }
    }

    async function getPostById(postId) {
      try {
        console.log("start GetPostId in index", postId)
        const { rows: [ post ]  } = await client.query(`
          SELECT *
          FROM posts
          WHERE id=$1;
        `, [postId]);
    
        const { rows: tags } = await client.query(`
          SELECT tags.*
          FROM tags
          JOIN post_tags ON tags.id=post_tags."tagId"
          WHERE post_tags."postId"=$1;
        `, [postId])
        
        console.log("in here getPostId in index", post)

        const { rows: [author] } = await client.query(`
          SELECT id, username, name, location
          FROM users
          WHERE id=$1;
        `, [post.authorId])
    
        post.tags = tags;
        post.author = author;
    
        delete post.authorId;
        
        console.log("at the end in getPostId", post)
        return post;
      } catch (error) {
        throw error;
      }
    }


    async function getPostsByTagName(tagName) {
      try {
        const { rows: postIds } = await client.query(`
          SELECT posts.id
          FROM posts
          JOIN post_tags ON posts.id=post_tags."postId"
          JOIN tags on tags.id=post_tags."tagId"
          WHERE tags.name=$1;
          `, [tagName]);

          return await Promise.all(postIds.map(
            post => getPostById(post.id)
          ));
        } catch (error) {
          throw error;
        }
    }

    async function getAllTags(){
      try {
        console.log("beggining if getAllTag in index db");
        const { rows } = await client.query(
          `SELECT *
          FROM tags`
        );
        console.log("finished with getAllTags in index db")
      return rows;
      } catch (error) {
        throw error
      }
    }

    async function getUserByUsername(username) {
      try {
        console.log("beginning of getUserByUsername")

        const { rows: [user] } = await client.query(`
        SELECT *
        FROM users
        WHERE username=$1;
        `, [username]);

        console.log("finishing it up in getUserByUsername")

        return user;
      } catch (error) {
        throw error;
      }
    }
module.exports = {
    client,
    getAllUsers,
    createUser,
    updateUser,
    createPost,
    updatePost,
    getAllPosts,
    getPostsByUser,
    getUserById,
    createTags,
    createPostTag,
    addTagsToPost,
    getPostById,
    getPostsByTagName,
    getAllTags,
    getUserByUsername
}