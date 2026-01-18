// 帖子管理功能
class PostManager {
  constructor() {
    this.token = localStorage.getItem('adminToken');
    this.isAdmin = !!this.token;
    this.currentPage = 1;
    this.postsPerPage = 6;
    this.allPosts = [];
    this.init();
  }

  async init() {
    this.setupEventListeners();
    if (this.isAdmin) {
      this.showCreatePostForm();
    }
  }

  setupEventListeners() {
    // 发布新帖子按钮
    const publishPostBtn = document.getElementById('publish-post-btn');
    if (publishPostBtn) {
      publishPostBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.createPost();
      });
    }

    // 编辑帖子按钮（如果在管理员页面）
    const editPostButtons = document.querySelectorAll('.edit-post-btn');
    editPostButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const postId = e.target.dataset.postId;
        this.editPost(postId);
      });
    });
  }

  // 显示创建帖子表单
  showCreatePostForm() {
    const formContainer = document.querySelector('.create-post-form') || this.createFormElement();
    if (formContainer) {
      document.body.appendChild(formContainer);
    }
  }

  // 创建帖子表单元素
  createFormElement() {
    const formContainer = document.createElement('div');
    formContainer.className = 'modal-overlay hidden';
    formContainer.id = 'create-post-modal';
    formContainer.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>创建新帖子</h3>
          <button class="close-modal">&times;</button>
        </div>
        <form id="create-post-form">
          <div class="form-group">
            <label for="post-title">标题 *</label>
            <input type="text" id="post-title" name="title" required maxlength="200">
          </div>
          
          <div class="form-group">
            <label for="post-category">分类 *</label>
            <select id="post-category" name="category" required>
              <option value="">选择分类</option>
              <option value="技术">技术</option>
              <option value="生活">生活</option>
              <option value="思考">思考</option>
              <option value="随笔">随笔</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="post-author">作者</label>
            <input type="text" id="post-author" name="author" maxlength="50">
          </div>
          
          <div class="form-group">
            <label for="post-image">封面图片URL</label>
            <input type="text" id="post-image" name="image">
          </div>
          
          <div class="form-group">
            <label for="post-excerpt">摘要 *</label>
            <textarea id="post-excerpt" name="excerpt" rows="3" required maxlength="500"></textarea>
          </div>
          
          <div class="form-group">
            <label for="post-content">内容 *</label>
            <textarea id="post-content" name="content" rows="10" required></textarea>
          </div>
          
          <div class="form-group">
            <label for="post-status">状态</label>
            <select id="post-status" name="status">
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-primary">发布帖子</button>
            <button type="button" class="btn-secondary cancel-create">取消</button>
          </div>
        </form>
      </div>
    `;
    
    // 添加事件监听器
    const closeModalBtn = formContainer.querySelector('.close-modal');
    const cancelBtn = formContainer.querySelector('.cancel-create');
    const postForm = formContainer.querySelector('#create-post-form');
    
    closeModalBtn.addEventListener('click', () => this.hideModal(formContainer));
    cancelBtn.addEventListener('click', () => this.hideModal(formContainer));
    
    postForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createPost();
    });
    
    return formContainer;
  }

  // 显示模态框
  showModal(modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  // 隐藏模态框
  hideModal(modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    // 清空表单
    const form = modal.querySelector('form');
    if (form) {
      form.reset();
    }
  }

  // 创建帖子
  async createPost() {
    if (!this.isAdmin) {
      this.showMessage('需要管理员权限才能创建帖子', 'error');
      return;
    }

    const title = document.getElementById('post-title').value;
    const category = document.getElementById('post-category').value;
    const author = document.getElementById('post-author').value || 'Anonymous';
    const image = document.getElementById('post-image').value;
    const excerpt = document.getElementById('post-excerpt').value;
    const content = document.getElementById('post-content').value;
    const status = document.getElementById('post-status').value;

    if (!title || !category || !excerpt || !content) {
      this.showMessage('请填写所有必填字段', 'error');
      return;
    }

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          title,
          category,
          author,
          image,
          excerpt,
          content,
          status
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showMessage('帖子创建成功', 'success');
        this.hideModal(document.getElementById('create-post-modal'));
        
        // 如果是已发布的帖子，更新前端显示
        if (status === 'published') {
          // 刷新页面或更新列表
          location.reload();
        }
      } else {
        this.showMessage(result.error || '创建帖子失败', 'error');
      }
    } catch (error) {
      console.error('创建帖子错误:', error);
      this.showMessage('创建帖子时发生错误', 'error');
    }
  }

  // 编辑帖子
  async editPost(postId) {
    if (!this.isAdmin) {
      this.showMessage('需要管理员权限才能编辑帖子', 'error');
      return;
    }

    try {
      // 获取帖子详情
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        // 填充编辑表单
        this.populateEditForm(result.post);
        // 显示编辑模态框
        const editModal = document.getElementById('edit-post-modal');
        if (editModal) {
          this.showModal(editModal);
        }
      } else {
        this.showMessage(result.error || '获取帖子详情失败', 'error');
      }
    } catch (error) {
      console.error('获取帖子详情错误:', error);
      this.showMessage('获取帖子详情时发生错误', 'error');
    }
  }

  // 填充编辑表单
  populateEditForm(post) {
    // 创建编辑表单（如果尚未存在）
    if (!document.getElementById('edit-post-modal')) {
      this.createEditForm();
    }

    document.getElementById('edit-post-title').value = post.title || '';
    document.getElementById('edit-post-category').value = post.category || '';
    document.getElementById('edit-post-author').value = post.author || '';
    document.getElementById('edit-post-image').value = post.image || '';
    document.getElementById('edit-post-excerpt').value = post.excerpt || '';
    document.getElementById('edit-post-content').value = post.content || '';
    document.getElementById('edit-post-status').value = post.status || 'draft';
    document.getElementById('edit-post-id').value = post.id || '';
  }

  // 创建编辑表单
  createEditForm() {
    const editFormContainer = document.createElement('div');
    editFormContainer.className = 'modal-overlay hidden';
    editFormContainer.id = 'edit-post-modal';
    editFormContainer.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>编辑帖子</h3>
          <button class="close-modal">&times;</button>
        </div>
        <form id="edit-post-form">
          <input type="hidden" id="edit-post-id" name="id">
          <div class="form-group">
            <label for="edit-post-title">标题 *</label>
            <input type="text" id="edit-post-title" name="title" required maxlength="200">
          </div>
          
          <div class="form-group">
            <label for="edit-post-category">分类 *</label>
            <select id="edit-post-category" name="category" required>
              <option value="">选择分类</option>
              <option value="技术">技术</option>
              <option value="生活">生活</option>
              <option value="思考">思考</option>
              <option value="随笔">随笔</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="edit-post-author">作者</label>
            <input type="text" id="edit-post-author" name="author" maxlength="50">
          </div>
          
          <div class="form-group">
            <label for="edit-post-image">封面图片URL</label>
            <input type="text" id="edit-post-image" name="image">
          </div>
          
          <div class="form-group">
            <label for="edit-post-excerpt">摘要 *</label>
            <textarea id="edit-post-excerpt" name="excerpt" rows="3" required maxlength="500"></textarea>
          </div>
          
          <div class="form-group">
            <label for="edit-post-content">内容 *</label>
            <textarea id="edit-post-content" name="content" rows="10" required></textarea>
          </div>
          
          <div class="form-group">
            <label for="edit-post-status">状态</label>
            <select id="edit-post-status" name="status">
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-primary">更新帖子</button>
            <button type="button" class="btn-secondary cancel-edit">取消</button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(editFormContainer);
    
    // 添加事件监听器
    const closeModalBtn = editFormContainer.querySelector('.close-modal');
    const cancelBtn = editFormContainer.querySelector('.cancel-edit');
    const editForm = editFormContainer.querySelector('#edit-post-form');
    
    closeModalBtn.addEventListener('click', () => this.hideModal(editFormContainer));
    cancelBtn.addEventListener('click', () => this.hideModal(editFormContainer));
    
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.updatePost();
    });
  }

  // 更新帖子
  async updatePost() {
    if (!this.isAdmin) {
      this.showMessage('需要管理员权限才能更新帖子', 'error');
      return;
    }

    const id = document.getElementById('edit-post-id').value;
    const title = document.getElementById('edit-post-title').value;
    const category = document.getElementById('edit-post-category').value;
    const author = document.getElementById('edit-post-author').value;
    const image = document.getElementById('edit-post-image').value;
    const excerpt = document.getElementById('edit-post-excerpt').value;
    const content = document.getElementById('edit-post-content').value;
    const status = document.getElementById('edit-post-status').value;

    if (!id || !title || !category || !excerpt || !content) {
      this.showMessage('请填写所有必填字段', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          title,
          category,
          author,
          image,
          excerpt,
          content,
          status
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showMessage('帖子更新成功', 'success');
        this.hideModal(document.getElementById('edit-post-modal'));
        // 刷新页面
        location.reload();
      } else {
        this.showMessage(result.error || '更新帖子失败', 'error');
      }
    } catch (error) {
      console.error('更新帖子错误:', error);
      this.showMessage('更新帖子时发生错误', 'error');
    }
  }

  // 显示消息
  showMessage(message, type) {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `alert alert-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 4px;
      color: white;
      z-index: 10000;
      min-width: 300px;
    `;
    
    if (type === 'success') {
      messageEl.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
      messageEl.style.backgroundColor = '#dc3545';
    }
    
    document.body.appendChild(messageEl);
    
    // 3秒后移除消息
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }
}

// 初始化帖子管理器
document.addEventListener('DOMContentLoaded', () => {
  const postManager = new PostManager();
});