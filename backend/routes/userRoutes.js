const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser
} = require('../controllers/userController');

//console.log("USER CONTROLLERS:", {
  //getAllUsers,
  //getUserById,
  //updateUserRole,
  //deleteUser
     //});

// @route   GET /api/users
// @desc    Get all users
router.get('/', getAllUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID
router.get('/:id', getUserById);

// @route   PUT /api/users/:id
// @desc    Update user role
router.put(
  '/:id',
  [body('role').notEmpty().withMessage('Role is required')],
  updateUserRole
);

// @route   DELETE /api/users/:id
// @desc    Delete user
router.delete('/:id', deleteUser);

module.exports = router;
